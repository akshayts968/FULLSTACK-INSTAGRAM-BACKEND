const Album = require('../model/Album');
const Notification = require('../model/Notification');
const User = require('../model/User');

const toIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

const hasAlbumAccess = (album, userId) => {
  const uid = String(userId);
  return (
    toIdString(album.owner) === uid ||
    (album.members || []).some((m) => toIdString(m) === uid)
  );
};

const createAlbum = async (req, res) => {
  try {
    const {
      ownerId,
      name,
      memberIds = [],
      timeCapsuleEnabled = false,
      revealAt
    } = req.body;

    if (!ownerId || !name?.trim()) {
      return res.status(400).json({ message: 'ownerId and album name are required' });
    }

    const invitees = Array.from(new Set((Array.isArray(memberIds) ? memberIds : []).filter((id) => String(id) !== String(ownerId))));
    const album = await Album.create({
      owner: ownerId,
      name: name.trim(),
      members: [ownerId],
      pendingInvites: invitees,
      isPrivate: true,
      timeCapsuleEnabled: Boolean(timeCapsuleEnabled),
      revealAt: timeCapsuleEnabled && revealAt ? new Date(revealAt) : null
    });

    const owner = await User.findById(ownerId).select('username');
    if (invitees.length && owner) {
      const notifications = invitees.map((inviteeId) => ({
        recipient: inviteeId,
        sender: ownerId,
        type: 'album_invite',
        content: `${owner.username} invited you to collaborate on album "${album.name}"`,
        link: `/albums/${album._id}`
      }));
      await Notification.insertMany(notifications);
    }

    return res.status(201).json(album);
  } catch (error) {
    console.error('Error creating album:', error);
    return res.status(500).json({ message: 'Failed to create album' });
  }
};

const respondAlbumInvite = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { userId, action } = req.body;
    if (!userId || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'userId and valid action are required' });
    }

    const album = await Album.findById(albumId);
    if (!album) return res.status(404).json({ message: 'Album not found' });

    const isInvited = (album.pendingInvites || []).some((id) => String(id) === String(userId));
    if (!isInvited) return res.status(404).json({ message: 'Invite not found or already handled' });

    album.pendingInvites = (album.pendingInvites || []).filter((id) => String(id) !== String(userId));
    if (action === 'accept' && !(album.members || []).some((id) => String(id) === String(userId))) {
      album.members.push(userId);
    }
    await album.save();

    await Notification.deleteMany({
      recipient: userId,
      type: 'album_invite',
      link: `/albums/${albumId}`
    });

    return res.json({ message: `Invite ${action}ed`, album });
  } catch (error) {
    console.error('Error responding to album invite:', error);
    return res.status(500).json({ message: 'Failed to respond to invite' });
  }
};

const getAlbumsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const albums = await Album.find({
      $or: [{ owner: userId }, { members: userId }]
    })
      .populate('owner', 'username name profile')
      .populate('members', 'username name profile')
      .sort({ updatedAt: -1 });
    return res.json(albums);
  } catch (error) {
    console.error('Error fetching albums:', error);
    return res.status(500).json({ message: 'Failed to fetch albums' });
  }
};

const getAlbumDetails = async (req, res) => {
  try {
    const { albumId, userId } = req.params;
    const album = await Album.findById(albumId)
      .populate('owner', 'username name profile')
      .populate('members', 'username name profile')
      .populate('items.uploader', 'username name profile');

    if (!album) return res.status(404).json({ message: 'Album not found' });
    if (!hasAlbumAccess(album, userId)) {
      return res.status(403).json({ message: 'You do not have access to this album' });
    }

    const now = new Date();
    const shouldBlur = album.timeCapsuleEnabled && album.revealAt && now < album.revealAt;

    const payload = {
      ...album.toObject(),
      items: (album.items || []).map((item) => ({
        ...item,
        isBlurred: Boolean(shouldBlur),
        canReveal: !shouldBlur
      }))
    };

    return res.json(payload);
  } catch (error) {
    console.error('Error fetching album details:', error);
    return res.status(500).json({ message: 'Failed to fetch album details' });
  }
};

const addAlbumItems = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { userId, mediaUrls = [] } = req.body;

    if (!userId) return res.status(400).json({ message: 'userId is required' });
    if (!Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      return res.status(400).json({ message: 'At least one mediaUrl is required' });
    }

    const album = await Album.findById(albumId);
    if (!album) return res.status(404).json({ message: 'Album not found' });
    if (!hasAlbumAccess(album, userId)) {
      return res.status(403).json({ message: 'Only album members can upload' });
    }

    const newItems = mediaUrls.map((url) => ({
      uploader: userId,
      mediaUrl: url
    }));
    album.items.push(...newItems);
    await album.save();

    return res.json({ message: 'Photos added to album', count: newItems.length });
  } catch (error) {
    console.error('Error adding album items:', error);
    return res.status(500).json({ message: 'Failed to add album photos' });
  }
};

module.exports = { createAlbum, getAlbumsByUser, getAlbumDetails, addAlbumItems, respondAlbumInvite };
