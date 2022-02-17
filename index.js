const mongoose = require('mongoose');
async function main() {
    await mongoose.connect(process.env.MONGO_URL);
}

const Resources = new mongoose.Schema({
    title: String,
    type: String,
    content: String
});

main().then( () => {
    console.log('Connected');
    process.exit();
}).catch(err => console.log(err));
