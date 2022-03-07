module.exports = function (Resource,Category) {
    return new Promise((resolve, reject) => {
        Resource.find().exec((err, resourceList) => {
            Category.deleteMany({}).then(() => {
                generateCategory(0,resourceList,Category,{}, (dataList) => {
                    const multiPromises = [];
                    for(let key in dataList){
                        multiPromises.push(saveData(dataList[key],Category));
                    }
                    Promise.all(multiPromises).then(() => {
                        resolve(dataList);
                    });
                });
            });
        });
    });
}
function saveData(obj,Category){
    return new Promise((resolve, reject) => {
        const category = new Category({
            title: obj.title,
            children: obj
        });
        category.save((err, data) => {
            resolve();
        });
    });
}
function generateCategory(index, resourceList,Category,obj, cb){
    if(index >= resourceList.length){
        cb(obj);
        return;
    }
   const breadCrumb = resourceList[index].breadCrumb.split('/').filter((item) => { return item !== ''});
    generateSubCategory(0, breadCrumb,obj,resourceList[index] ).then( (objzter) => {
        if(index >= resourceList.length){
            cb(objzter);
        } else {
            index++;
            generateCategory(index, resourceList,Category,objzter, cb);
        }
    });
}

function generateSubCategory(index, breadCrumbList,obj,resource ){
    return new Promise((resolve, reject) => {
        if(index >= breadCrumbList.length) {
            const findLanguage =  obj[breadCrumbList[index]].children.find(child => {return child.language === resource.language && child._id === resource._id; });
            if(typeof findLanguage === "undefined") {
                obj[breadCrumbList[index]].children.push({
                    language: resource.language,
                    _id: resource._id,
                    title: resource.title
                });
            }
            resolve(obj);
        }else {
            if(typeof  obj[breadCrumbList[index]] === "undefined") {
                obj[breadCrumbList[index]] = {
                    title: breadCrumbList[index],
                    type: 'folder',
                    children: []
                }
            }
            const newIndex = index + 1;

            if(newIndex >= breadCrumbList.length) {
                const findLanguage =  obj[breadCrumbList[index]].children.find(child => {return child.language === resource.language && child._id === resource._id; });
                if(typeof findLanguage === "undefined") {
                    obj[breadCrumbList[index]].children.push({
                        language: resource.language,
                        _id: resource._id,
                        title: resource.title
                    });
                }
                resolve(obj);
            }else {

                const findChild =  obj[breadCrumbList[index]].children.find(child => {return child.title === breadCrumbList[newIndex]});
                if(typeof findChild === "undefined") {
                    generateSubCategory(newIndex,breadCrumbList,{},resource ).then( (dataItem) => {
                        const findChild =  obj[breadCrumbList[index]].children.find(child => {return child.title ===dataItem.title;});
                        if(typeof findChild === "undefined") {
                            obj[breadCrumbList[index]].children.push(dataItem);
                        }
                        resolve(obj);
                    });
                }else {
                    generateSubCategory(newIndex,breadCrumbList,findChild,resource ).then( (dataItem) => {
                        obj[breadCrumbList[index]].children.push(dataItem);
                        resolve(obj);
                    });
                }
            }

        }
    });
}

