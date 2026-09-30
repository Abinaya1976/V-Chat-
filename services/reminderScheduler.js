const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendPushToUser } = require('./pushNotificationService');

/**
 * Calculate the next reminder time for repeating reminders
 * @param {Date} currentTime
 * @param {string} repeat - 'daily' | 'weekly' | 'monthly'
 * @returns {Date}
 */
const calculateNextReminderTime = (currentTime, repeat) => {
  const next = new Date(currentTime);
  const now = new Date();

  do {
    if (repeat === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (repeat === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (repeat === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else {
      break;
    }
  } while (next <= now);

  return next;
};

let schedulerInterval = null;

/**
 * Initialize server-side scheduler to process due reminders
 * @param {Object} io - Socket.IO server instance
 */
const initReminderScheduler = (io) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const checkDueReminders = async () => {
    try {
      const now = new Date();

      // Find due pending or snoozed reminders that have not been notified yet
      const dueReminders = await Reminder.find({
        deleted: false,
        status: { $ne: 'completed' },
        $or: [
          { status: 'pending', reminderTime: { $lte: now }, isNotified: false },
          { status: 'snoozed', snoozedUntil: { $lte: now } },
        ],
      });

      if (dueReminders.length === 0) return;

      for (const rawReminder of dueReminders) {
        // Atomic claim/lock to guarantee duplicate prevention during concurrent ticks or restarts
        const reminder = await Reminder.findOneAndUpdate(
          {
            _id: rawReminder._id,
            isNotified: false,
            deleted: false,
            status: { $ne: 'completed' },
          },
          {
            $set: { isNotified: true },
          },
          { new: true }
        );

        if (!reminder) continue; // Already claimed by another tick

        const userIdStr = (reminder.userId?._id || reminder.userId)?.toString();

        // 1. Create exactly ONE in-app Notification using existing Notification model
        try {
          const notification = await Notification.create({
            recipient: reminder.userId,
            organization: reminder.organization || null,
            sender: reminder.userId,
            type: 'reminder_due',
            content: `Reminder: "${reminder.title}"`,
            reminderId: reminder._id,
            conversationId: reminder.conversationId || null,
            channelId: reminder.channelId || null,
            isRead: false,
          });

          const populatedNotif = await Notification.findById(notification._id)
            .populate('sender', 'name email avatar')
            .populate('conversationId')
            .populate('channelId', 'name isPrivate');

          if (io && userIdStr && populatedNotif) {
            // Emit in-app notification event to user room
            io.to(`user:${userIdStr}`).emit('notification:new', {
              notification: populatedNotif,
            });

            // Emit unread notification count update
            const unreadCount = await Notification.countDocuments({
              recipient: reminder.userId,
              isRead: false,
              ...(reminder.organization ? { organization: reminder.organization } : {}),
            });

            io.to(`user:${userIdStr}`).emit('notification:unread_count', {
              unreadCount,
            });
          }
        } catch (notifErr) {
          console.error('Error creating in-app notification for reminder:', notifErr.message);
        }

        // 2. Dispatch Bot Message if it's a bot-managed reminder
        try {
          const botType = reminder.source === 'google_calendar' ? 'calendar' : 'reminder';
          const botUser = await User.findOne({ isSystemBot: true, botType });
          
          if (botUser) {
            // Find or create a direct conversation between user and bot
            let conversation = await Conversation.findOne({
              organization: reminder.organization,
              participants: { $all: [reminder.userId, botUser._id], $size: 2 }
            });
            
            if (!conversation) {
              conversation = await Conversation.create({
                organization: reminder.organization,
                participants: [reminder.userId, botUser._id]
              });
            }
            
            let messageContent = `🔔 Reminder: "${reminder.title}" is due!`;
            if (reminder.source === 'google_calendar') {
              if (reminder.googleEventId && reminder.googleEventId.endsWith('_10min')) {
                messageContent = `📅 Google Calendar Event: "${reminder.title}" is starting in 10 minutes!`;
              } else if (reminder.googleEventId && reminder.googleEventId.endsWith('_exact')) {
                messageContent = `📅 Google Calendar Event: "${reminder.title}" is starting now!`;
              } else {
                messageContent = `📅 Google Calendar Event: "${reminder.title}" is starting soon!`;
              }
            }
            if (reminder.description) {
              messageContent += `\n\n${reminder.description}`;
            }
            
            const botMessage = await Message.create({
              conversationId: conversation._id,
              sender: botUser._id,
              receiver: reminder.userId,
              content: messageContent,
              organization: reminder.organization,
            });
            
            conversation.lastMessage = botMessage._id;
            conversation.lastMessageAt = botMessage.createdAt;
            await conversation.save();

            // Dispatch Push Notification
            try {
              await sendPushToUser(reminder.userId, {
                title: 'V Chat Reminder',
                body: messageContent,
                data: {
                  type: 'reminder',
                  reminderId: reminder._id.toString(),
                  conversationId: conversation._id.toString(),
                  url: `/`
                }
              });
            } catch (pushErr) {
              console.error('Error dispatching push notification for reminder:', pushErr.message);
            }
            
            // Emit new message event to the user
            if (io && userIdStr) {
              const populatedMessage = await Message.findById(botMessage._id).populate('sender', 'name email avatar isSystemBot botType');
              io.to(`user:${userIdStr}`).emit('message:new', populatedMessage);
              
              // Also emit conversation update so it bubbles up to the top of the sidebar
              io.to(`user:${userIdStr}`).emit('conversation:updated', {
                conversationId: conversation._id,
                lastMessage: populatedMessage,
                lastMessageAt: conversation.lastMessageAt,
              });
            }
          }
        } catch (botErr) {
          console.error('Error dispatching bot message:', botErr.message);
        }

        // 3. Handle repeat logic or auto-complete status transition
        if (reminder.repeat && reminder.repeat !== 'never') {
          const nextTime = calculateNextReminderTime(reminder.reminderTime, reminder.repeat);
          reminder.reminderTime = nextTime;
          reminder.status = 'pending';
          reminder.isNotified = false;
          reminder.snoozedUntil = null;
          await reminder.save();
        } else {
          reminder.status = 'completed';
          reminder.completedAt = new Date();
          reminder.snoozedUntil = null;
          await reminder.save();
        }

        // 4. Emit real-time reminder:due event with updated status ('completed') so UI moves it to Completed immediately
        const populatedReminder = await Reminder.findById(reminder._id)
          .populate('userId', 'name email avatar')
          .populate('conversationId')
          .populate('channelId', 'name isPrivate');

        if (io && userIdStr && populatedReminder) {
          io.to(`user:${userIdStr}`).emit('reminder:due', {
            reminder: populatedReminder,
          });
        }
      }
    } catch (err) {
      console.error('Error in reminder scheduler check:', err.message);
    }
  };

  // Run initial check immediately on server startup, then every 10 seconds
  checkDueReminders();
  schedulerInterval = setInterval(checkDueReminders, 10000);
  console.log('⏰ Server-side Reminder Scheduler initialized (checking every 10s)');
};

module.exports = {
  initReminderScheduler,
  calculateNextReminderTime,
};
