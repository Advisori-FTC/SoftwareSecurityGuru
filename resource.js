const sponsorPath = "contentlib/categories";
const path = require('path');
const fs = require('fs');
const mdParser = require('md-hierarchical-parser')
const { spawn, exec } = require('child_process');
let tagList = {};
module.exports = function (Resource,Tag, VersionHistory) {
    return new Promise((resolve, reject) => {
        Resource.find().exec((err, resourceList) => {
            let copyResourceList = JSON.parse(JSON.stringify(resourceList));
            getFiles(sponsorPath).then((fileList) => {
                let multiPromises = [];
                fileList.forEach((file) => {
                    if(path.extname(file) === ".md") {
                        let found = false;
                        let tempFileName = path.basename(file).replace('.md','').split('_');
                        if(tempFileName.length > 1) {
                            const language = tempFileName[0].toLowerCase();
                            const fileName = tempFileName[1].toLowerCase();
                            resourceList.forEach( (resource) => {
                                if(resource.title === fileName) {
                                    found = true;
                                    copyResourceList.splice(copyResourceList.findIndex((item) => {return item.title === fileName;}),1);
                                }
                            });
                            multiPromises.push(createUpdateRessource(fileName,file,language, found, Resource, VersionHistory ));
                        }
                    }
                });
                Promise.all(multiPromises).then(() => {
                    let multiPromisesDelete = [];
                    copyResourceList.forEach( (resource) => {
                        multiPromisesDelete.push(deletePartner(resource.title, resource.language,resource.type, Resource));
                    });
                    Promise.all(multiPromisesDelete).then(() =>{
                        updateCrateTags(Tag).then(() => {
                            resolve();
                        });
                    })
                });
            });
        });
    });
}


function getFiles(root) {
    return fs.promises
        .readdir(root, { withFileTypes: true })
        .then(dirents => {
            const mapToPath = (r) => (dirent) => path.resolve(r, dirent.name)
            const directoryPaths = dirents.filter(a => a.isDirectory()).map(mapToPath(root))
            const filePaths = dirents.filter(a => a.isFile()).map(mapToPath(root))

            return Promise.all([
                ...directoryPaths.map(a => getFiles(a)).flat(),
                ...filePaths.map(a => Promise.resolve(a))
            ]).then(a => a.flat())
        })
}
function createUpdateRessource(fileName,file, language, found, Resource, VersionHistory  ){
    return new Promise((resolve) => {
        const type = getType(file);
        const breadCrumb = file.replace(fileName + '.md','').replace(fileName + '.md','').split(sponsorPath)[1].replace('/'+ path.basename(file),'');
        mdParser.run(file, true, true).then( (structure) => {
            const tags = getTags(JSON.parse(structure));
            fs.readFile(file,(err, dataContent) => {
                let multiPromisesStructure = [];
                JSON.parse(structure).forEach((line) => {
                    if(line.type === "heading") {
                        multiPromisesStructure.push(generateStructure(line));
                    }
                });
                Promise.all(multiPromisesStructure).then((newStructure) => {
                    getAuthors(file).then((authors) => {
                        const authorsList = authors.toString().replace('\t','').split('\n').filter((item) => { return item !== '';});
                        if(found === false) {
                            const newResource = new Resource({
                                title: fileName,
                                authors:authorsList,
                                type: type,
                                content: dataContent.toString('utf8'),
                                likes:0,
                                views:0,
                                versionHistory:'',
                                language: language,
                                tags: tags,
                                breadCrumb: breadCrumb,
                                structure: JSON.stringify(newStructure)
                            });
                            newResource.save((err, data) => {
                                resolve();
                            });
                        }else {
                            Resource.updateMany({ title: fileName,  language: language,  type: type },{
                                $set: {
                                    title: fileName,
                                    authors:authorsList,
                                    type: type,
                                    content: dataContent.toString('utf8'),
                                    versionHistory:'',
                                    language: language,
                                    tags: tags,
                                    breadCrumb: breadCrumb,
                                    structure: JSON.stringify(newStructure)
                                }
                            }, (err,data) => {
                                resolve();
                            });
                        }
                    });
                });
            });
        });
    });
}
function getType(filePath){
    if(filePath.indexOf('/articles/') !== -1){
        return 'ARTICLE'
    } else  if(filePath.indexOf('/news/') !== -1){
        return 'NEWS'
    } else  if(filePath.indexOf('/tutorials/') !== -1){
        return 'TUTORIAL'
    }
}
function getTags (structure){
    let tagTempList = [];
    structure.forEach((tag) => {
        if(tag.type === 'heading'){
            if(tag.children[0].value === 'Tags'){
                if(tag.children.length > 1) {
                    tag.children[1].children.forEach((child) => {
                        tagTempList.push(child.children[0].children[0].value);
                        tagList[child.children[0].children[0].value] = '';
                    });
                }
            }
        }
    });
    return tagTempList;
}
function generateStructure(structure){
    return new Promise((resolve, reject) => {
        let obj = {
            title: structure.children[0].value,
            id: structure.depth + '_'+ structure.children[0].value,
            children:[]
        }
        if(structure.children.length > 1) {
            const multiPromises = [];
            structure.children.forEach((line) => {
                if(line.type === "heading") {
                    multiPromises.push(generateStructure(line));
                }
            });
            Promise.all(multiPromises).then((children) => {
                obj.children = children;
                resolve(obj);
            });
        }else {
            resolve(obj);
        }
    });
}
function getAuthors(filePath){
    return new Promise((resolve, reject) => {
        exec('git log --pretty=format:"%an%x09" "' + filePath +'" | sort | uniq', (err, stdout, stderr) => {
            if (err) {
                return;
            }
            resolve(stdout);
        });
    });
}
function deletePartner(title,language,type,Resource) {
    return  Resource.deleteOne({ title: title,  language: language,  type: type })
}
function updateCrateTags(Tag){
    return new Promise((resolve, reject) => {
        Tag.deleteMany({}).then(() => {
            let newTagList = [];
            for(let key in tagList) {
                newTagList.push(key);
            }
            multiCreateTag(0,Tag,newTagList, () => {
                resolve();
            });
        });
    });
}
function multiCreateTag(index,Tag, list,cb){
    if(index >= list.length) {
        cb();
    }else {
        const newTag = new Tag({name: list[index]});
        newTag.save((err, data) => {
            index++;
            multiCreateTag(index,Tag, list,cb);
        });
    }
}
