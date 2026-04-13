const test = require('node:test');
const assert = require('node:assert/strict');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const messageController = require('../controllers/messageController');
const User = require('../model/User');
const Message = require('../model/Message');
const Notification = require('../model/Notification');

const makeRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  res.send = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

test('auth flow smoke: signup registers and login returns user', async () => {
  const originalRegister = User.register;
  User.register = async (newUser) => ({ ...newUser.toObject?.(), _id: 'u1', username: 'demo' });

  const signupReq = { body: { username: 'demo', email: 'demo@test.com', password: '123456', name: 'Demo' } };
  const signupRes = makeRes();
  await authController.signup(signupReq, signupRes);
  assert.equal(signupRes.statusCode, 200);
  assert.equal(signupRes.body.username, 'demo');

  const loginReq = { user: { _id: 'u1', username: 'demo' } };
  const loginRes = makeRes();
  authController.login(loginReq, loginRes);
  assert.equal(loginRes.body.user.username, 'demo');

  User.register = originalRegister;
});

test('follow-request smoke: private account creates request', async () => {
  const originalFindById = User.findById;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const originalSave = Notification.prototype.save;

  const privateUser = { _id: 'owner1', isPrivate: true, pendingFollowRequests: [], followers: [], followings: [], username: 'owner' };
  const requester = { _id: 'req1', followings: [], followers: [], username: 'requester' };

  User.findById = async (id) => (id === 'owner1' ? privateUser : requester);
  User.findByIdAndUpdate = async (id) => ({ _id: id, username: id === 'owner1' ? 'owner' : 'requester' });
  Notification.prototype.save = async () => {};

  const req = { params: { id: 'owner1', uId: 'req1' } };
  const res = makeRes();
  await userController.followUser(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.isRequested, true);

  User.findById = originalFindById;
  User.findByIdAndUpdate = originalFindByIdAndUpdate;
  Notification.prototype.save = originalSave;
});

test('messages pagination smoke: returns ordered window with hasMore', async () => {
  const originalCountDocuments = Message.countDocuments;
  const originalFind = Message.find;

  Message.countDocuments = async () => 12;
  Message.find = () => ({
    sort: () => ({
      skip: () => ({
        limit: async () => [
          { _id: 'm5', timestamp: new Date('2026-01-01T10:05:00Z') },
          { _id: 'm6', timestamp: new Date('2026-01-01T10:06:00Z') }
        ]
      })
    })
  });

  const req = { params: { userId: 'u1', receiverId: 'u2' }, query: { offset: '5', limit: '2' } };
  const res = makeRes();
  await messageController.getMessages(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.body.messages), true);
  assert.equal(res.body.messages.length, 2);
  assert.equal(res.body.hasMore, true);

  Message.countDocuments = originalCountDocuments;
  Message.find = originalFind;
});

test('stories CRUD smoke: deleteStory removes one story item', async () => {
  const originalFindById = User.findById;
  const userDoc = {
    _id: 'u1',
    stories: [
      { _id: 's1', mediaUrl: 'a.jpg' },
      { _id: 's2', mediaUrl: 'b.jpg' }
    ],
    story: 'b.jpg',
    save: async function save() { return this; }
  };
  User.findById = async () => userDoc;

  const req = { params: { id: 'u1', storyId: 's1' } };
  const res = makeRes();
  await userController.deleteStory(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.stories.length, 1);
  assert.equal(res.body.user.story, 'b.jpg');

  User.findById = originalFindById;
});
