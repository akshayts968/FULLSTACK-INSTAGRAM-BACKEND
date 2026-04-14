const Post = require('../model/Post');
const User = require('../model/User');
const Comment = require('../model/Comment');
const cloudinary = require('../config/cloudinary')
const mongoose = require('mongoose');
const { redisClient } = require('../config/redis');

const CACHE_TTL = 300; // 5 minutes in seconds

const canViewPrivateContent = (owner, viewerId) => {
  if (!owner) return false;
  if (!owner.isPrivate) return true;
  if (!viewerId) return false;
  const viewerIdStr = String(viewerId);
  const isOwner = String(owner._id) === viewerIdStr;
  const isFollower = (owner.followers || []).some((id) => String(id) === viewerIdStr);
  return isOwner || isFollower;
};

const extractMention = (comment) => {
  if (!comment) return { mention: null, remaining: "" };
  const strComment = String(comment);
  
  if (strComment.startsWith('@')) {
    const spaceIndex = strComment.indexOf(' ');
    if (spaceIndex !== -1) {
      return {
        mention: strComment.substring(0, spaceIndex),
        remaining: strComment.substring(spaceIndex + 1).trim()
      };
    } else {
      return {
        mention: strComment,
        remaining: ""
      };
    }
  }
  return { mention: null, remaining: strComment.trim() };
};

const createPost = async (req, res) => {
  req.setTimeout(300000);
  const id = req.params.id;
  const body = Object.assign({}, req.body);
  const description = body.Description;
  console.log(body, "THIS is body of create post")

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No file uploaded or file exceeds 10MB limit." });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    const resType = isVideo ? 'video' : 'image';

    const streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          { folder: "wanderlust_DEV", resource_type: resType, chunk_size: 6000000, timeout: 240000 },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        const { Readable } = require('stream');
        Readable.from(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload(req);
    const postUrl = result.secure_url;

    // --- NEW THUMBNAIL LOGIC ---
    let thumbnailUrl = postUrl;
    if (isVideo) {
      // Cloudinary trick: change the video extension to .jpg to get the generated thumbnail
      thumbnailUrl = postUrl.replace(/\.[^/.]+$/, ".jpg");
    }
    // ---------------------------

    let parsedTags = [];
    if (req.body.tags) {
      try {
        parsedTags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
      } catch (e) {
        console.error('Tag parsing error:', e);
        parsedTags = Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags).split(',');
      }
    }
    if (!Array.isArray(parsedTags)) parsedTags = [parsedTags];
    parsedTags = [...new Set(
      parsedTags
        .map((id) => String(id).trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )];

    const newPost = new Post({
      videourl: postUrl,
      thumbnailUrl: thumbnailUrl, // Save the newly created thumbnail URL
      postOwner: id,
      description: description || "",
      isReel: req.body.isReel === 'true' || req.body.isReel === true,
      taggedUsers: parsedTags
    });


    const savedPost = await newPost.save();

    // Cache invalidation: Clear all feed caches when a new post is created
    try {
      if (redisClient.isOpen) {
        const keys = await redisClient.keys('feed:*');
        if (keys && keys.length > 0) await redisClient.del(...keys);
        console.log("Feed cache invalidated due to new post");
      }
    } catch (err) {
      console.error("Redis invalidation error:", err);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $push: { post: savedPost._id }, $inc: { nPost: 1 } },
      { new: true }
    );

    res.status(201).json({ savedPost, user });
  } catch (error) {
    console.error("Upload Error controller:", error);
    res.status(500).json({ message: "Failed to create post. Please check file size and connection." });
  }
};

const getPost = async (req, res) => {
  try {
    const viewerId = req.query.viewerId;
    const user = await User.findById(req.params.id).populate("post");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!canViewPrivateContent(user, viewerId)) {
      return res.status(403).json({ message: "This account is private. Follow to view posts." });
    }
    res.json({ data: user.post, User: user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPostByUser = async (req, res) => {
  try {
    const viewerId = req.query.viewerId;
    const queryParam = req.params.username;
    let query = { username: queryParam };
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(queryParam)) {
      query = { $or: [{ _id: queryParam }, { username: queryParam }] };
    }
    const user = await User.findOne(query).populate("post");
    if (!user) return res.status(404).json({ message: "User not found" });
    const isAllowed = canViewPrivateContent(user, viewerId);
    if (!isAllowed) {
      return res.json({ data: [], User: user, isPrivateLocked: true });
    }
    return res.json({ data: user.post, User: user, isPrivateLocked: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePost = async (req, res) => {
  const { commentId, post } = req.body;
  try {
    const { mention, remaining } = extractMention(req.body.comment);
    const CommentData = new Comment({
      text: remaining,
      owner: req.body.userId,
      replies: [],
    });
    console.log("Naina", mention, remaining, CommentData);
    const savedComment = await CommentData.save();
    let updateUserResult;
    if (mention) {
      updateUserResult = await Comment.findByIdAndUpdate(
        commentId,
        {
          $push: { replies: savedComment._id },
          $inc: { nReply: 1 },
        },
        { new: true }
      );
      console.log('Comment updated:', updateUserResult);
    } else {
      updateUserResult = await Post.findByIdAndUpdate(
        req.body.post,
        {
          $push: { comments: savedComment._id },
          $inc: { nComments: 1 },
        },
        { new: true }
      );
    }


    res.status(200).json({ savedComment, updateUserResult }); // Sending the saved comment back in the response
  } catch (error) {
    console.error("Error updating post with new comment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const deletePost = async (req, res) => {
  const { id } = req.params;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const userId = post.postOwner._id;
    console.log(post.videourl, "data to delete");
    const urlParts = post.videourl.split('/');
    const publicIdWithExtension = urlParts.slice(-1)[0];
    const publicId = publicIdWithExtension.split('.')[0];

    console.log('Extracted Public ID:', publicId); // Should print: wanderlust_DEV/jhzsrwgy5o0rddipl22u

    await cloudinary.uploader.destroy(`wanderlust_DEV/${publicId}`, (error, result) => {
      if (error) {
        console.error('Error deleting image:', error);
      } else {
        console.log('Image delete result:', result);
      }
    });
    await Post.findByIdAndDelete(id);

    // Cache invalidation: Clear all feed caches when a post is deleted
    try {
      if (redisClient.isOpen) {
        const keys = await redisClient.keys('feed:*');
        if (keys && keys.length > 0) await redisClient.del(...keys);
        console.log("Feed cache invalidated due to post deletion");
      }
    } catch (err) {
      console.error("Redis invalidation error:", err);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $pull: { post: id },
        $inc: { nPost: -1 },
      },
      { new: true }
    );

    res.status(200).json({ message: 'Post deleted successfully', user });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const deleteAll = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await Comment.deleteMany({});
  } catch (error) {
    console.error('Error deleting posts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const allPosts = async (req, res) => {
  try {
    const viewerId = req.query.viewerId || 'anonymous';
    const cacheKey = `feed:${viewerId}`;

    // 1. Try to get from Redis
    if (redisClient.isOpen) {
      try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          console.log(`Cache Hit for ${cacheKey}`);
          // @upstash/redis might auto-parse JSON if it was stored as an object, 
          // but we stored a string, so we parse it if it's a string.
          const data = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData;
          return res.json(data);
        }
      } catch (redisError) {
        console.error("Redis GET error:", redisError);
      }
    }

    // 2. Cache Miss: Fetch from DB
    console.log(`Cache Miss for ${cacheKey}. Fetching from DB...`);
    const posts = await Post.find({}).populate('postOwner');
    const filteredPosts = posts.filter((post) => canViewPrivateContent(post.postOwner, req.query.viewerId));
    
    const responseData = { posts: filteredPosts };

    // 3. Store in Redis
    if (redisClient.isOpen) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(responseData), {
          ex: CACHE_TTL // @upstash/redis uses lowercase 'ex' or standard options
        });
        console.log(`Cached data for ${cacheKey}`);
      } catch (redisError) {
        console.error("Redis SET error:", redisError);
      }
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Server error');
  }
};
const likePost = async (req, res) => {
  const postId = req.params.id;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "User ID missing" });

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const isLiked = post.likes.includes(userId);
    let updatedPost;
    if (isLiked) {
      updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $pull: { likes: userId }, $inc: { nLikes: -1 } },
        { new: true }
      );
    } else {
      updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $push: { likes: userId }, $inc: { nLikes: 1 } },
        { new: true }
      );
    }
    res.json({ likes: updatedPost.likes });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPostLikesDetails = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Likes are stored sequentially; usually oldest first. Let's return them sequentially.
    // If you want newest first, you'd Reverse the slice logic. We'll do simple slice here.
    // Reversed slice for newest likes first:
    const reversedLikes = [...post.likes].reverse();
    const startIndex = (page - 1) * limit;
    const paginatedIds = reversedLikes.slice(startIndex, startIndex + limit);

    const users = await User.find({ _id: { $in: paginatedIds } }).select('username profile name');
    
    // Sort the users to match the array order since $in returns them in arbitrary order
    const sortedUsers = paginatedIds.map(id => users.find(u => String(u._id) === String(id))).filter(Boolean);

    res.json({
      users: sortedUsers,
      hasMore: startIndex + limit < reversedLikes.length
    });
  } catch (error) {
    console.error('Error fetching like details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createPost, getPost, getPostByUser, updatePost, deletePost, allPosts, deleteAll, likePost, getPostLikesDetails };
