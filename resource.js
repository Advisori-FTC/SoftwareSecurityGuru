const sponsorPath = "contentlib/categories";
const path = require('path');
const fs = require('fs');
const mdjs = require("@moox/markdown-to-json");


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
                        let myFilename = path.basename(file);
                        resourceList.forEach( (resource) => {
                            if(resource.fileName === myFilename) {
                                found = true;
                                copyResourceList.splice(copyResourceList.findIndex((item) => {return item.fileName === myFilename;}),1);
                            }
                        });
                        multiPromises.push(createUpdateRessource(myFilename,file,"", found, Resource, VersionHistory ));
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

            fs.readFile(file,(err, dataContent) => {
                if(err){
                    console.log(err);
                    return;
                }
                if(dataContent.toString('utf8').indexOf('<!--CONFIG-END-->') !== -1) {
                    const configContent = dataContent.toString('utf8').split('<!--CONFIG-END-->')[0].replace('<!--CONFIG-START-->','').replace('\r','');
                    const configFile = mdjs.markdownAsJsTree(configContent).body.children;
                    const dataFromArticle = extractDataFromArticle(configFile,fileName,dataContent.toString('utf8'));
                    if(dataFromArticle.content.split('<!--CONFIG-END-->')[1].length > 0) {
                        dataFromArticle.content = dataFromArticle.content.split('<!--CONFIG-END-->')[1];
                    }
                    const tempJSONContent = mdjs.markdownAsJsTree(dataFromArticle.content);
                    generateStructure(tempJSONContent.headings,1,[]).then((newStructure) => {
                        gitlog({
                            repo:  __dirname,
                            number: 20,
                            file: file,
                            execOptions: { maxBuffer: 1000 * 1024 },
                        }, function (error, commits) {
                            if (error) {
                                console.log(error);
                                return;
                            }
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
                                    previewContent: dataFromArticle.previewContent,
                                    fileName:fileName
                                });
                                newResource.save((err, data) => {
                                    if(err){
                                        console.log(err);
                                        return;
                                    }
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
                                        previewContent: dataFromArticle.previewContent,
                                        fileName:fileName
                                    }
                                }, (err,data) => {
                                    if(err){
                                        console.log(err);
                                        return;
                                    }
                                    resolve();
                                });
                            }
                        });
                    });
                } else{
                    console.error('Config File not Found in ' + file);
                    resolve();
                }
        });
    });
}
function generateStructure(structure, level, menue){
    return new Promise((resolve, reject) => {
        let multiPromise = [];
        structure.forEach((dataItem) => {
            if(dataItem.level === level){
                let tempObj = {
                    id: dataItem.level + '_' + dataItem.id,
                    title: dataItem.text,
                    children:[]
                };
                tempLevel = level + 1;
                multiPromise.push(generateStructure(structure,tempLevel ,tempObj));
            }
        });
        Promise.all(multiPromise).then((listMenus) => {
            if(Array.isArray(menue) === true) {
                menue = listMenus;
            }else {
                menue.children = listMenus;
            }
            resolve(menue);
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
function extractDataFromArticle(newStructure, fileName, dataContent) {
    let title = '';
    let type = '';
    let authors = [];
    let tags = [];
    let previewPicture = '';
    let previewContent = '';
    let lng = '';
    for(let i = 0; i < newStructure.length; i = i + 2) {
        const dataItem = newStructure[i];
        let dataItemValue;
        if(newStructure[i + 1] === '\n' || newStructure[i + 1] === '\r'){
            dataItemValue = newStructure[i + 2];
        }else {
            dataItemValue = newStructure[i + 1];
        }
        if(dataItem.tag === 'h1') {
            switch (dataItem.props.id) {
                case 'apptitle':
                    if(typeof dataItemValue.children !== "undefined") {
                        if(dataItemValue.children.length > 0) {
                            title = dataItemValue.children[0];
                        }
                    }
                    break;
                case 'apptype':
                    if(typeof dataItemValue.children !== "undefined") {
                        if (dataItemValue.children.length > 0) {
                            type = dataItemValue.children[0];
                        }
                    }
                    break;
                case 'apppreviewcontent':
                    if(typeof dataItemValue.children !== "undefined") {
                        if (dataItemValue.children.length > 0) {
                            previewContent = dataItemValue.children[0];
                        }
                    }
                    break;
                case 'appauthors':

                    if(typeof dataItemValue.children !== "undefined") {
                        if (dataItemValue.children.length > 0) {
                            dataItemValue.children.forEach((author) => {
                                if(author !== '\n') {
                                    if(author.children.length > 0) {
                                        authors.push(author.children[0]);
                                    }
                                }
                            });
                        }
                    }
                    break;
                case 'applanguage':
                    if(typeof dataItemValue.children !== "undefined") {
                        if (dataItemValue.children.length > 0) {
                            lng = dataItemValue.children[0];
                        }
                    }
                    break;
                case 'apptags':
                    if(typeof dataItemValue.children !== "undefined") {
                        if (dataItemValue.children.length > 0) {
                            dataItemValue.children.forEach((tag) => {
                                if(tag !== '\n') {
                                    if(tag.children.length > 0) {
                                        tags.push(tag.children[0]);
                                    }
                                }
                            });
                        }
                    }
                    break;
            }
        }
    }

    if(title === ""){
        title = fileName;
    }
    if(previewPicture === ''){
        switch (type) {
            case 'Article':
                previewPicture = '/assets/defaultArticle.png';
            case 'Tutorial':
                previewPicture = '/assets/defaultTutorial.png';
            case 'News':
                previewPicture = '/assets/defaultNews.png';
        }

    }
    tags.forEach((tag) => {
        tagList[tag] = '';
    });
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
