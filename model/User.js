const mongoose = require('mongoose');
const Schema=mongoose.Schema;
const Post=require('./Post');
const  passportLocalMongoose=require("passport-local-mongoose");

const newUser=new Schema({
    email:{
        type:String,
        required:true,
    },
    story:{
        type:String,
    },
    highlight:[
        {
            name: { type: String, default: 'Highlight' },
            cover: { type: String },
            medias: [{ type: String }]
        }
    ],
    profile:{
        type:String,
        default:"https://i.pinimg.com/originals/44/bf/66/44bf66ebb891eef4f48b8492f001c938.jpg",
        set:(v) =>
        v===""
        ?"https://i.pinimg.com/originals/44/bf/66/44bf66ebb891eef4f48b8492f001c938.jpg"
        :v,
    },
    nPost:{
        type:Number,
        default:0
    },
    followers:[
        {
            type:Schema.Types.ObjectId,
            ref:"User",
        }
    ],
    followings:[
        {
            type:Schema.Types.ObjectId,
            ref:"User",
        }
    ],
    nFollowers:{
        type:Number,
        default:0
    },
    nFollowing:{
        type:Number,
        default:0
    },
    name:{
        type:String,
        required:true
    },
    field:{
        type:String,
    },
    thread:{
        type:String,
    },
    post:[
        {
            type:Schema.Types.ObjectId,
            ref:"Post",
        }
    ]
});
newUser.plugin(passportLocalMongoose);

const User=mongoose.model("User",newUser);
module.exports=User;