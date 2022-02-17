const mongoose = require('mongoose');
async function main() {
    console.log(process.env);

    await mongoose.connect(process.env.MONGO_URL);
}

const Resources = new mongoose.Schema({
    title: String,
    type: String,
    content: String
});

main().then( () => {

}).catch(err => console.log(err));
