const sponsorPath = "contentlib/categories";
const path = require('path');
const fs = require('fs');
const mdParser = require('md-hierarchical-parser')
const { spawn, exec } = require('child_process');
const gitlog = require("gitlog").default;
let tagList = {};
const specialComands = ['AppTitle','AppType', 'AppAuthors', 'AppTags', 'AppPreviewPicture', 'AppPreviewContent', 'AppLanguage'];
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
        const breadCrumb = file.replace(fileName + '.md','').replace(fileName + '.md','').split(sponsorPath)[1].replace('/'+ path.basename(file),'');
        mdParser.run(file, true, true).then( (structure) => {
            fs.readFile(file,(err, dataContent) => {
                let multiPromisesStructure = [];
                JSON.parse(structure).forEach((line) => {
                    if(line.type === "heading") {
                        multiPromisesStructure.push(generateStructure(line));
                    }
                });
                Promise.all(multiPromisesStructure).then((newStructure) => {
                    const dataFromArticle = extractDataFromArticle(newStructure,fileName,dataContent.toString('utf8'));
                    gitlog({
                        repo:  __dirname,
                        number: 20,
                        file: file,
                        execOptions: { maxBuffer: 1000 * 1024 },
                    }, function (error, commits) {
                        commits = commits.map((dataItem) => {
                            return {
                                _id: dataItem.hash,
                                author: dataItem.authorName,
                                message: dataItem.subject,
                                githubLink: 'https://github.com/Advisori-FTC/SoftwareSecurityGuru/commit/' + dataItem.hash,
                                timestamp: dataItem.authorDate
                            }
                        });
                        // Commits is an array of commits in the repo
                        if(found === false) {
                            const newResource = new Resource({
                                title: dataFromArticle.title,
                                authors:dataFromArticle.authors,
                                type: dataFromArticle.type,
                                content: dataFromArticle.content,
                                likes:0,
                                views:0,
                                versionHistory: JSON.stringify(commits),
                                language: dataFromArticle.lng,
                                tags: dataFromArticle.tags,
                                breadCrumb: breadCrumb,
                                structure: JSON.stringify(newStructure),
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                previewPicture: dataFromArticle.previewPicture,
                                previewContent: dataFromArticle.previewContent
                            });
                            newResource.save((err, data) => {
                                resolve();
                            });
                        }else {
                            Resource.updateMany({
                                $and:[
                                    {
                                        title: dataFromArticle.title
                                    } ,
                                    {
                                        language: dataFromArticle.lng
                                    },
                                    {
                                        type:dataFromArticle.type
                                    }
                                ]
                            },{
                                $set: {
                                    title: dataFromArticle.title,
                                    authors: dataFromArticle.authors,
                                    type: dataFromArticle.type,
                                    content: dataFromArticle.content,
                                    versionHistory:JSON.stringify(commits),
                                    language: dataFromArticle.lng,
                                    tags: dataFromArticle.tags,
                                    breadCrumb: breadCrumb,
                                    structure: JSON.stringify(newStructure),
                                    updatedAt: new Date(),
                                    previewPicture: dataFromArticle.previewPicture,
                                    previewContent: dataFromArticle.previewContent
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
function generateStructure(structure){
    return new Promise((resolve, reject) => {
        let obj = {
            title: structure.children[0].value,
            id: structure.depth + '_'+ structure.children[0].value,
            children:[],
            specialContent:''
        }
        if(specialComands.indexOf(structure.children[0].value) !== -1){
            if(structure.children[1].children[0].type === 'text') {
                obj.specialContent = structure.children[1].children[0].value;
            }
            if(structure.children[1].children[0].type === 'listItem') {
                obj.specialContent = structure.children[1].children.map((dataItem) => {

                    return dataItem.children[0].children[0].value;
                });
            }
            if(structure.children[1].children[0].type === 'inlineLink') {
                obj.specialContent = structure.children[1].children[0].value;
            }
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
function extractDataFromArticle(newStructure,fileName, dataContent) {
    let title = '';
    let titleIndex = newStructure.findIndex((dataItem) => { return dataItem.title === 'AppTitle'; });
    if(titleIndex !== -1) {
        title = newStructure[titleIndex].specialContent;
    }else {
        title = fileName;
    }
    let type = '';
    let typeIndex = newStructure.findIndex((dataItem) => { return dataItem.title === 'AppType'; });
    if(typeIndex !== -1) {
        type = newStructure[typeIndex].specialContent;
    }
    let authors = [];
    let authorsIndex = newStructure.findIndex((dataItem) => { return dataItem.title === 'AppAuthors'; });
    if(authorsIndex !== -1) {
        authors = newStructure[authorsIndex].specialContent;
    }
    let tags = [];
    let tagsIndex = newStructure.findIndex((dataItem) => { return dataItem.title === 'AppTags'; });
    if(tagsIndex !== -1) {
        tags = newStructure[tagsIndex].specialContent;
    }
    tags.forEach((tag) => {
        tagList[tag] = '';
    });
    let previewPicture = '';
    let previewPictureIndex = newStructure.findIndex((dataItem) => { return dataItem.title === 'AppPreviewPicture'; });
    if(previewPictureIndex !== -1) {
        previewPicture = newStructure[previewPictureIndex].specialContent;
    }
    if(previewPicture === ''){
        previewPicture = '/assets/examplePics/nodeJSExample.png';
    }
    let previewContent = '';
    let previewContentIndex = newStructure.findIndex((dataItem) => { return dataItem.title === 'AppPreviewContent'; });
    if(previewContentIndex !== -1) {
        previewContent = newStructure[previewContentIndex].specialContent;
    }
    let lng = '';
    let lngIndex = newStructure.findIndex((dataItem) => { return dataItem.title === 'AppLanguage'; });
    if(lngIndex !== -1) {
        lng = newStructure[lngIndex].specialContent;
    }
    return {
        title,
        authors,
        previewPicture,
        previewContent,
        tags,
        type,
        lng,
        newStructure,
        content:dataContent
    }
}
