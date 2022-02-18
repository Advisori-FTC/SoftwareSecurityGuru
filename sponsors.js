var fs = require('fs');
var path = require("path");
const sponsorPath = "contentlib/sponsors";
const pathToGithubCDN = '';
module.exports = function (Partner) {
    return new Promise((resolve, reject) => {
        Partner.find().exec((err, partnerList) => {
            fs.readdir(sponsorPath,{}, function(err,files){
                if (err) {
                    throw err;
                }
                let multiPromises = [];
                files.map(function (file) {
                    return path.join(sponsorPath, file);
                }).filter(function (file) {
                    return !fs.statSync(file).isFile();
                }).forEach(function (file) {
                    let found = false;
                    let index = 0;
                    const directoryTitle = file.replace(sponsorPath + '/','');
                    console.log(partnerList);
                    partnerList.forEach( (partner) => {
                        if(partner.name === directoryTitle) {
                            found = true;
                            partnerList.splice(index,0);
                        }
                        index++;
                    });
                    multiPromises.push(createUpdatePartner(file.replace(sponsorPath + '/',''), found, Partner));
                });
                Promise.all(multiPromises).then(() => {
                    resolve();
                });
            });
        });
    });
}

function createUpdatePartner(directoryTitle, found, Partner){
    return new Promise( (resolve, reject) => {
        fs.readFile(sponsorPath + '/' +directoryTitle +'/url.txt',(err, url) => {
            const partner = new Partner({
                name: directoryTitle,
                imageUrl: pathToGithubCDN + sponsorPath + '/' +directoryTitle +'/logo.png',
                homepageUrl: url.toString('utf8')
            });
            if(found === false) {
                partner.save((err, data) => {
                     console.log(err);
                    resolve();
                });
            } else {
                partner.updateOne({ name: directoryTitle},{
                    name: directoryTitle,
                    imageUrl: pathToGithubCDN + sponsorPath + '/' +directoryTitle +'/logo.png',
                    homepageUrl: url.toString('utf8')
                }, (err,data) => {
                    console.log(err);
                    resolve();
                });
            }
        });
    });
}
