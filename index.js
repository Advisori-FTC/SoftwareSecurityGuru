const mongoose = require('mongoose');
async function main() {
    await mongoose.connect(process.env.MONGO_URL);
}

const ResourceSchema = new mongoose.Schema({
    authors: [String],
    title: String,
    type: String,
    content: String,
    likes: Number,
    views: Number,
    versionHistory: String,
    language: String,
    tags: [String],
    breadCrumb: String,
    structure: mongoose.Schema.Types.Mixed
}, {collection: 'Resources'});
const Resource = mongoose.model('Resources', ResourceSchema);
const CategorySchema = new mongoose.Schema({
    title: String,
    children: mongoose.Schema.Types.Mixed
},  {collection: 'Categories'});
const Category = mongoose.model('Categories', CategorySchema);
const PartnerSchema = new mongoose.Schema({
    name: String,
    imageUrl: String,
    homepageUrl: String
},  {collection: 'Partners'});
const Partner = mongoose.model('Partners', PartnerSchema);
const TagSchema = new mongoose.Schema({
    name: String
}, {collection: 'Tags'});
const Tag = mongoose.model('Tags', TagSchema);
const VersionHistorySchema = new mongoose.Schema({
    _id: String,
    author: String,
    message: String,
    githubLink: String
}, {collection: 'VersionHistories'});
const VersionHistory = mongoose.model('VersionHistories', VersionHistorySchema);
main().then( async () => {
    await require('./sponsors')(Partner);
    console.log('Connected');
    process.exit();
}).catch(err => console.log(err));
