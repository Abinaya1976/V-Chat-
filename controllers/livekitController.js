const { AccessToken } = require('livekit-server-sdk');
const Conversation = require('../models/Conversation');
const Channel = require('../models/Channel');

exports.generateToken = async (req, res) => {
  try {
    const { roomName, participantName, conversationId, channelId } = req.body;
    const userId = req.user.id;
    const orgId = req.user.currentOrganizationId || req.user.currentOrganization?._id?.toString() || req.user.currentOrganization?.toString();

    if (!roomName || !participantName) {
      return res.status(400).json({ success: false, message: 'roomName and participantName are required' });
    }

    // Verify user authorization for the room
    if (conversationId) {
      const conv = await Conversation.findOne({ _id: conversationId, participants: userId });
      if (!conv) return res.status(403).json({ success: false, message: 'Not authorized for this conversation' });
    } else if (channelId) {
      const channel = await Channel.findOne({ _id: channelId, members: userId });
      if (!channel) return res.status(403).json({ success: false, message: 'Not authorized for this channel' });
    } else {
      return res.status(400).json({ success: false, message: 'Must provide either conversationId or channelId' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ success: false, message: 'LiveKit credentials not configured on server' });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    res.status(500).json({ success: false, message: 'Server error generating token' });
  }
};
