const User = require('../models/User');

/**
 * Initializes System Bots (Reminder Bot, Google Calendar Bot) in the database.
 * If they don't exist, they are created.
 */
const initSystemBots = async () => {
  try {
    const bots = [
      {
        name: 'Reminder Bot',
        email: 'reminder-bot@system.local',
        password: 'system-bot-password-never-used', // Required field
        isSystemBot: true,
        botType: 'reminder',
        role: 'user',
        status: 'active',
      },
      {
        name: 'Google Calendar Bot',
        email: 'calendar-bot@system.local',
        password: 'system-bot-password-never-used',
        isSystemBot: true,
        botType: 'calendar',
        role: 'user',
        status: 'active',
      },
      {
        name: 'System Bot',
        email: 'system-bot@system.local',
        password: 'system-bot-password-never-used',
        isSystemBot: true,
        botType: 'system',
        role: 'user',
        status: 'active',
      }
    ];

    for (const botData of bots) {
      let bot = await User.findOne({ email: botData.email });
      if (!bot) {
        bot = new User(botData);
        await bot.save();
        console.log(`🤖 Initialized ${bot.name}`);
      }
    }
  } catch (err) {
    console.error('Failed to initialize system bots:', err.message);
  }
};

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * Dispatches a message from a System Bot to a Channel, Conversation, or User.
 * @param {Object} options
 * @param {string} options.botType - 'system' | 'reminder' | 'calendar'
 * @param {string} options.content - The message content
 * @param {string} [options.channelId] - The channel ID to send to
 * @param {string} [options.conversationId] - The conversation ID to send to
 * @param {string} [options.userId] - The user ID to send to (direct message)
 * @param {string} options.organizationId - The organization ID
 * @param {Object} [options.io] - Socket.io instance to emit real-time event
 */
const dispatchSystemBotMessage = async ({ botType = 'system', content, channelId, conversationId, userId, organizationId, io }) => {
  try {
    const botUser = await User.findOne({ isSystemBot: true, botType });
    if (!botUser) {
      console.warn(`System Bot of type ${botType} not found.`);
      return null;
    }

    const messageData = {
      sender: botUser._id,
      content,
      organization: organizationId,
    };

    let targetConversationId = conversationId;

    if (channelId) {
      messageData.channelId = channelId;
    } else if (userId) {
      // Find or create direct conversation between bot and user
      let conversation = await Conversation.findOne({
        organization: organizationId,
        participants: { $all: [userId, botUser._id], $size: 2 }
      });
      if (!conversation) {
        conversation = await Conversation.create({
          organization: organizationId,
          participants: [userId, botUser._id]
        });
      }
      targetConversationId = conversation._id;
      messageData.conversationId = targetConversationId;
    } else if (conversationId) {
      messageData.conversationId = conversationId;
    } else {
      console.warn('dispatchSystemBotMessage requires channelId, conversationId, or userId');
      return null;
    }

    const botMessage = await Message.create(messageData);
    
    // Populate message for socket emission
    const populatedMessage = await Message.findById(botMessage._id).populate('sender', 'name email avatar isSystemBot botType');

    if (io) {
      if (channelId) {
        io.to(`channel:${channelId}`).emit('message:new', populatedMessage);
      } else if (targetConversationId) {
        // Find conversation to update lastMessage and emit to participants
        const conversation = await Conversation.findById(targetConversationId);
        if (conversation) {
          conversation.lastMessage = botMessage._id;
          conversation.lastMessageAt = botMessage.createdAt;
          await conversation.save();
          
          conversation.participants.forEach(participantId => {
            io.to(`user:${participantId.toString()}`).emit('message:new', populatedMessage);
            io.to(`user:${participantId.toString()}`).emit('conversation:updated', {
              conversationId: conversation._id,
              lastMessage: populatedMessage,
              lastMessageAt: conversation.lastMessageAt,
            });
          });
        }
      }
    }
    
    return populatedMessage;
  } catch (err) {
    console.error('Error dispatching system bot message:', err.message);
    return null;
  }
};

module.exports = { initSystemBots, dispatchSystemBotMessage };
