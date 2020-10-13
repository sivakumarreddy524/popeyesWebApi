var request = require("request");
const lodash = require('lodash')
export function getMenuByProfitCenter(tenantId, branchId, profitCenterId, pool) {
    let categoriesQuery = `select mc.*,bmc.active as pactive from menu_category mc , branch_profit_center_menu_category bmc  
    where mc.tenant_id=${tenantId} 
    and bmc.menu_category_id = mc.id
    and bmc.branch_id = ${branchId}
    and bmc.profit_center_id = ${profitCenterId};`
    let taxMapQuery = `select tg.tenant_id AS tenant_id,tg.id AS taxable_group_id,tr.id as tax_rate_id,tg.name AS group_name,tgr.rate_basis 
    AS rate_basis,tgr.tax_basis AS tax_basis,tr.name AS name,tr.tax_value AS tax_value,tr.tax_inclusive AS tax_inclusive 
    from ((taxable_group tg join tax_group_rule tgr) join tax_rate tr) 
    where ((tg.tenant_id = ${tenantId}) and (tg.id = tgr.taxable_group_id) and (tgr.tax_rate_id = tr.id)) order by tg.id;`
    let itemsQuery = `select m.*,mi.name as primary_item_name,mi.external_reference_no,mi.alt_name,mi.item_code,bpmc.price as pprice,bpmc.active as pactive from menu_item mi ,menu m
    inner join  
    branch_profit_center_menu bpmc ON bpmc.menu_id = m.id
    where m.tenant_id=${tenantId} and mi.tenant_id=${tenantId} and m.primary_item_id=mi.id  and bpmc.branch_id=${branchId} and
    bpmc.active=true and
    bpmc.profit_center_id=${profitCenterId};`
    let profitCenterQuery = `select * from profit_center where tenant_id=${tenantId} order by id limit 1`
    let categories, parentCats, subCats, taxes, items, profitCenter = null
    return new Promise(async (resolve, reject) => {
        try {
            let promises = [];
            let categoriesProm = new Promise(async (res1, rej1) => {
                try {
                    console.log("categoriesQuery => " + categoriesQuery);
                    await pool.query(categoriesQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  1  ========> " + err);
                            rej1(err)
                        }
                        categories = results
                        categories.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                            element.active = element.pactive.lastIndexOf(1) == -1 ? false : true
                        });
                        res1()
                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej1(error)
                }
            });
            let profitCenterProm = new Promise(async (res2, rej2) => {
                try {
                    console.log("profitCenterQuery => " + profitCenterQuery);
                    await pool.query(profitCenterQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  1  ========> " + err);
                            rej2(err)
                        }
                        if (results && results.length > 0) {
                            profitCenter = results[0]
                        }
                        res2()
                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej2(error)
                }
            });
            let taxMapProm = new Promise(async (res3, rej3) => {
                try {
                    console.log("taxMapQuery => " + taxMapQuery);
                    await pool.query(taxMapQuery, async (err, results, fields) => {
                        if (err) {
                            rej3(err)
                        }
                        taxes = results
                        taxes.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res3()
                    })
                } catch (error) {
                    rej3(error)
                }
            });
            let itemsProm = new Promise(async (res4, rej4) => {
                try {
                    console.log("itemsQuery => " + itemsQuery);
                    await pool.query(itemsQuery, async (err, results, fields) => {
                        if (err) {
                            rej4(err)
                        }
                        items = results
                        items.forEach(element => {
                            element.price = element.pprice
                            element.active = element.pactive.lastIndexOf(1) == -1 ? false : true
                            element.is_recommended = element.is_recommended.lastIndexOf(1) == -1 ? false : true

                        });
                        res4()
                    })
                } catch (error) {
                    rej4(error)
                }
            });
            promises.push(categoriesProm)
            promises.push(taxMapProm)
            promises.push(itemsProm)
            promises.push(profitCenterProm)
            Promise.all(promises).then(res => {
                parentCats = lodash.filter(categories, x => x.parent_category_id === null);
                subCats = lodash.filter(categories, x => x.parent_category_id != null);
                let subCatsMap = new Map()
                let itemsMap = new Map()
                let taxMap = new Map()
                taxes.forEach(function (element) {
                    if (taxMap.has(element.taxable_group_id)) {
                        taxMap.get(element.taxable_group_id).push(element)
                    }
                    else {
                        taxMap.set(element.taxable_group_id, [])
                        taxMap.get(element.taxable_group_id).push(element)
                    }
                });
                items.forEach(function (element) {
                    if (itemsMap.has(element.menu_category_id)) {
                        itemsMap.get(element.menu_category_id).push(element)
                    }
                    else {
                        itemsMap.set(element.menu_category_id, [])
                        itemsMap.get(element.menu_category_id).push(element)
                    }
                });
                subCats.forEach(element => {
                    if (subCatsMap.has(element.parent_category_id)) {
                        subCatsMap.get(element.parent_category_id).push(element)
                    }
                    else {
                        subCatsMap.set(element.parent_category_id, [])
                        subCatsMap.get(element.parent_category_id).push(element)
                    }
                });
                let obj = []
                parentCats.forEach(parent => {
                    let cat = {
                        id: parent.id,
                        name: parent.name,
                        img: parent.image,
                        active: parent.active,
                        childCategories: [],
                        items: []
                    }
                    if (subCatsMap.has(parent.id)) {
                        subCatsMap.get(parent.id).forEach(child => {
                            console.log("parent => " + parent.id + " => " + child);
                        })
                        subCatsMap.get(parent.id).forEach(child => {
                            let subcat = {
                                id: child.id,
                                name: child.name,
                                img: child.image,
                                active: child.active,
                                childCategories: null,
                                items: []
                            }
                            if (itemsMap.has(child.id)) {
                                addItems(subcat, child, itemsMap.get(child.id), taxMap, profitCenter)
                            }
                            cat.childCategories.push(subcat)
                        });
                    }
                    else {
                        if (itemsMap.has(parent.id)) {
                            addItems(cat, parent, itemsMap.get(parent.id), taxMap, profitCenter)
                        }
                    }
                    obj.push(cat)
                });
                resolve(obj)
            }).catch(err => {
                console.error("error========> " + err);
                reject(err)
            });
        } catch (error) {
            console.error(error);
            reject(error)
        }
    })
}
export function getMenu(tenantId, pool) {
    let categoriesQuery = `select * from menu_category where tenant_id=${tenantId} and active=true;`
    let taxMapQuery = `select tg.tenant_id AS tenant_id,tg.id AS taxable_group_id,tr.id as tax_rate_id,tg.name AS group_name,tgr.rate_basis 
    AS rate_basis,tgr.tax_basis AS tax_basis,tr.name AS name,tr.tax_value AS tax_value,tr.tax_inclusive AS tax_inclusive 
    from ((taxable_group tg join tax_group_rule tgr) join tax_rate tr) 
    where ((tg.tenant_id = ${tenantId}) and (tg.id = tgr.taxable_group_id) and (tgr.tax_rate_id = tr.id)) order by tg.id;`
    let itemsQuery = `select m.*,mi.name as primary_item_name,mi.external_reference_no,mi.alt_name,mi.item_code from menu m,menu_item mi 
    where m.tenant_id=${tenantId} and mi.tenant_id=${tenantId} and m.primary_item_id=mi.id and mi.active=true and m.active=true;`
    let profitCenterQuery = `select * from profit_center where tenant_id=${tenantId} order by id limit 1`
    let categories, parentCats, subCats, taxes, items, profitCenter = null
    return new Promise(async (resolve, reject) => {
        try {
            let promises = [];
            let categoriesProm = new Promise(async (res1, rej1) => {
                try {
                    console.log("categoriesQuery => " + categoriesQuery);
                    await pool.query(categoriesQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  1  ========> " + err);
                            rej1(err)
                        }
                        categories = results
                        categories.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res1()
                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej1(error)
                }
            });
            let profitCenterProm = new Promise(async (res2, rej2) => {
                try {
                    console.log("profitCenterQuery => " + profitCenterQuery);
                    await pool.query(profitCenterQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  1  ========> " + err);
                            rej2(err)
                        }
                        if (results && results.length > 0) {
                            profitCenter = results[0]
                        }
                        res2()
                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej2(error)
                }
            });
            let taxMapProm = new Promise(async (res3, rej3) => {
                try {
                    console.log("taxMapQuery => " + taxMapQuery);
                    await pool.query(taxMapQuery, async (err, results, fields) => {
                        if (err) {
                            rej3(err)
                        }
                        taxes = results
                        taxes.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res3()
                    })
                } catch (error) {
                    rej3(error)
                }
            });
            let itemsProm = new Promise(async (res4, rej4) => {
                try {
                    console.log("itemsQuery => " + itemsQuery);
                    await pool.query(itemsQuery, async (err, results, fields) => {
                        if (err) {
                            rej4(err)
                        }
                        items = results
                        items.forEach(element => {
                            element.is_recommended = element.is_recommended.lastIndexOf(1) == -1 ? false : true
                        });
                        res4()
                    })
                } catch (error) {
                    rej4(error)
                }
            });
            promises.push(categoriesProm)
            promises.push(taxMapProm)
            promises.push(itemsProm)
            promises.push(profitCenterProm)
            Promise.all(promises).then(res => {
                parentCats = lodash.filter(categories, x => x.parent_category_id === null);
                subCats = lodash.filter(categories, x => x.parent_category_id != null);
                let subCatsMap = new Map()
                let itemsMap = new Map()
                let taxMap = new Map()
                taxes.forEach(function (element) {
                    if (taxMap.has(element.taxable_group_id)) {
                        taxMap.get(element.taxable_group_id).push(element)
                    }
                    else {
                        taxMap.set(element.taxable_group_id, [])
                        taxMap.get(element.taxable_group_id).push(element)
                    }
                });
                items.forEach(function (element) {
                    if (itemsMap.has(element.menu_category_id)) {
                        itemsMap.get(element.menu_category_id).push(element)
                    }
                    else {
                        itemsMap.set(element.menu_category_id, [])
                        itemsMap.get(element.menu_category_id).push(element)
                    }
                });
                subCats.forEach(element => {
                    if (subCatsMap.has(element.parent_category_id)) {
                        subCatsMap.get(element.parent_category_id).push(element)
                    }
                    else {
                        subCatsMap.set(element.parent_category_id, [])
                        subCatsMap.get(element.parent_category_id).push(element)
                    }
                });
                let obj = []
                parentCats.forEach(parent => {
                    let cat = {
                        id: parent.id,
                        name: parent.name,
                        img: parent.image,
                        priority: parent.priority,
                        childCategories: [],
                        items: []
                    }
                    if (subCatsMap.has(parent.id)) {
                        subCatsMap.get(parent.id).forEach(child => {
                            console.log("parent => " + parent.id + " => " + child);
                        })
                        subCatsMap.get(parent.id).forEach(child => {
                            let subcat = {
                                id: child.id,
                                name: child.name,
                                img: child.image,
                                priority: child.priority,
                                childCategories: null,
                                items: []
                            }
                            if (itemsMap.has(child.id)) {
                                addItems(subcat, child, itemsMap.get(child.id), taxMap, profitCenter)
                            }
                            cat.childCategories.push(subcat)
                        });
                    }
                    else {
                        if (itemsMap.has(parent.id)) {
                            addItems(cat, parent, itemsMap.get(parent.id), taxMap, profitCenter)
                        }
                    }
                    obj.push(cat)
                });
                resolve(obj)
            }).catch(err => {
                console.error("error========> " + err);
                reject(err)
            });
        } catch (error) {
            console.error(error);
            reject(error)
        }
    })
}
export function addItems(cat, category, items, taxMap: Map<any, any>, profitCenter) {
    if (items) {
        items.forEach(item => {
            let i = {
                id: item.id,
                name: item.primary_item_name,
                img: item.image,
                active: item.active,
                price: item.price,
                priority: item.priority,
                foodType: item.external_reference_no,
                tax_inclusive: category.tax_inclusive,
                alt_name: item.alt_name,
                item_code: item.item_code,
                taxes: [],
                is_recommended: item.is_recommended,
                description: item.description
            }
            if (category.taxable_group_id == null && profitCenter &&
                profitCenter.taxable_group_id != null && taxMap.has(profitCenter.taxable_group_id)) {
                taxMap.get(profitCenter.taxable_group_id).forEach(tt => {
                    let t = {
                        tax_rate_id: tt.tax_rate_id,
                        tax_name: tt.name,
                        tax_value: tt.tax_value
                    }
                    i.taxes.push(t)
                });
            }
            else {
                if (category.taxable_group_id != null && taxMap.has(category.taxable_group_id)) {
                    taxMap.get(category.taxable_group_id).forEach(tt => {
                        let t = {
                            tax_rate_id: tt.tax_rate_id,
                            tax_name: tt.name,
                            tax_value: tt.tax_value
                        }
                        i.taxes.push(t)
                    });
                }
            }
            cat.items.push(i)
        });
    }
}
export function getCategories(tenantId, pool) {
    let parentCatQuery = `select id,name,image from menu_category where tenant_id=${tenantId} and id in 
    (select distinct IFNULL(parent_category_id,0) from menu_category where tenant_id=${tenantId} and active=true) order by name;`
    let subCatQuery = `select id,parent_category_id as categoryid,name as header,last_updated as lastUpdated,
    date_created as dateCreated, 
        null as taxCategory,tax_inclusive as taxInclusive,null as taxBasis, null as taxAmount,
        case when taxable_group_id is null then (select id from taxable_group where tenant_id=${tenantId} order by id limit 1) else taxable_group_id end as taxablegroupid
        from menu_category mc where tenant_id=${tenantId} and active=true and id not in (select distinct IFNULL(parent_category_id,0) 
        from menu_category where tenant_id=${tenantId} and active=true);`
    let taxMapQuery = `select tg.tenant_id AS tenant_id,tg.id AS taxable_group_id,tg.name AS group_name,tgr.rate_basis 
    AS rate_basis,tgr.tax_basis AS tax_basis,tr.name AS name,tr.tax_value AS tax_value,tr.tax_inclusive AS tax_inclusive 
    from ((taxable_group tg join tax_group_rule tgr) join tax_rate tr) 
    where ((tg.tenant_id = ${tenantId}) and (tg.id = tgr.taxable_group_id) and (tgr.tax_rate_id = tr.id)) order by tg.id;`
    let itemsQuery = `select id,menu_category_id as categoryid,image as img, name as lable , allow_customization as 
        allowCustomization,no_of_drinks as noOfDrinks,no_of_side_items as noOfSides,1 as mains
        ,price, 'INR' as currency,null as 'desc' ,last_updated as lastUpdated,date_created as dateCreated,
        null as taxCategory,null as taxBasis,null as taxAmount, null as netPrice,null as taxValue 
        from menu where tenant_id=${tenantId} and active=true;`
    let parentCats, subCats, taxMaps, items
    return new Promise(async (resolve, reject) => {
        try {
            let promises = [];
            let parentCatProm = new Promise(async (res1, rej1) => {
                try {
                    console.log("parentCatQuery => " + parentCatQuery);
                    await pool.query(parentCatQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  1  ========> " + err);
                            rej1(err)
                        }
                        parentCats = results
                        res1()
                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej1(error)
                }
            });
            let subCatProm = new Promise(async (res2, rej2) => {
                try {
                    console.log("subCatQuery => " + subCatQuery);
                    await pool.query(subCatQuery, async (err, results, fields) => {
                        if (err) {
                            rej2(err)
                        }
                        subCats = results
                        subCats.forEach(element => {
                            element.taxInclusive = element.taxInclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res2()
                    })
                } catch (error) {
                    rej2(error)
                }
            });
            let taxMapProm = new Promise(async (res3, rej3) => {
                try {
                    console.log("taxMapQuery => " + taxMapQuery);
                    await pool.query(taxMapQuery, async (err, results, fields) => {
                        if (err) {
                            rej3(err)
                        }
                        taxMaps = results
                        taxMaps.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res3()
                    })
                } catch (error) {
                    rej3(error)
                }
            });
            let itemsProm = new Promise(async (res4, rej4) => {
                try {
                    console.log("itemsQuery => " + itemsQuery);
                    await pool.query(itemsQuery, async (err, results, fields) => {
                        if (err) {
                            rej4(err)
                        }
                        items = results
                        items.forEach(element => {
                            element.allowCustomization = element.allowCustomization.lastIndexOf(1) == -1 ? false : true;
                            element.is_recommended = element.is_recommended.lastIndexOf(1) == -1 ? false : true;
                        });
                        res4()
                    })
                } catch (error) {
                    rej4(error)
                }
            });
            promises.push(parentCatProm)
            promises.push(subCatProm)
            promises.push(taxMapProm)
            promises.push(itemsProm)
            Promise.all(promises).then(res => {
                let cat = {
                    id: null,
                    name: 'ALL',
                    image: null,
                    childs: null
                }
                cat.childs = lodash.filter(subCats, x => x.categoryid === null);
                parentCats.push(cat)
                let obj = parentCats
                parentCats.forEach(parent => {
                    parent.childs = lodash.filter(subCats, x => x.categoryid === parent.id);
                    parent.childs.forEach(child => {
                        let rateBasis = 'PCT'
                        let taxAmount = 0.0
                        let taxCategory = "VAT EXEMPTED";
                        child.taxBasis = rateBasis
                        child.taxAmount = taxAmount
                        child.taxCategory = taxCategory
                        if (!child.taxInclusive) {
                            let taxMap = lodash.filter(taxMaps, x => x.taxable_group_id === child.taxablegroupid);
                            taxMap.forEach(tax => {
                                rateBasis = tax.rate_basis
                                taxAmount += tax.tax_value
                                taxCategory = tax.name
                            });
                        }
                        child.taxCategory = taxCategory
                        child.taxBasis = rateBasis
                        child.taxAmount = taxAmount
                        child.items = lodash.filter(items, x => x.categoryid === child.id);
                        child.items.forEach(item => {
                            let tAmount = 0.0;
                            let netPrice = 0.0;
                            if (rateBasis == "PCT") {
                                tAmount = (taxAmount / 100) * item.price
                                netPrice = item.price + tAmount
                            }
                            else {
                                tAmount = taxAmount;
                                netPrice = item.price + tAmount
                            }
                            item.taxCategory = taxCategory
                            item.taxBasis = rateBasis
                            item.taxAmount = taxAmount
                            item.netPrice = netPrice
                            item.taxValue = tAmount
                        });
                    });
                });
                resolve(obj)
            }).catch(err => {
                console.error("error========> " + err);
                reject(err)
            });
        } catch (error) {
            console.error(error);
            reject(error)
        }
    })
}
export function getItem(tenantId: number, id: number, pool) {
    let subCats, taxMaps, item, menuOptions, menuItem
    return new Promise(async (resolve, reject) => {
        try {
            let promises = [];
            let itemQuery = `select id,menu_category_id as categoryid,name,price,image as img,null as shortDec,
            null as longDesc,allow_customization as allowCustomization,
            no_of_drinks as noOfDrinks,no_of_side_items as noOfSides,1 as noOfMains,0 as modifiers,0 as extras,
            last_updated as lastUpdated
            ,date_created as dateCreated,null as taxCategory,null as taxBasis,null as taxAmount,null as taxValue,
            null as netPrice from menu where  tenant_id=${tenantId} and active=true and id=${id};`
            let menuOptionQuery = `select mo.type as menuOptionType,0 as seq,add_on_price as addOnPrice,mo.quantity as qty,
            mi.name as menuItemName,mo.menu_item_id as menuItemId,mi.image as imageName,
            null as 'desc', null as taxCategory,null as taxBasis,0 as taxAmount,0 as netPrice,0 as taxValue
             from menu_option mo,menu_item mi where mo.menu_id=${id} and mo.menu_item_id=mi.id;`
            let menuItemQuery = `select 'MAIN' as menuOptionType,0 as seq,m.price as addOnPrice,1 as qty,mi.name as menuItemName,
             mi.id as menuItemId,mi.image as imageName,null as 'desc',null as taxCategory,null as taxBasis,0 as taxAmount,
             0 as netPrice,0 as taxValue
              from menu m,menu_item mi where m.tenant_id=${tenantId} and mi.tenant_id=${tenantId} 
              and m.primary_item_id=mi.id and m.active=true and m.id=${id};`
            let subCatQuery = `select id,parent_category_id as categoryid,name as header,last_updated as lastUpdated,
              date_created as dateCreated, 
                  null as taxCategory,tax_inclusive as taxInclusive,null as taxBasis, null as taxAmount,
                  case when taxable_group_id is null then (select id from taxable_group where tenant_id=${tenantId} order by id limit 1) else taxable_group_id end as taxablegroupid
                  from menu_category mc where tenant_id=${tenantId} and active=true and id not in (select distinct IFNULL(parent_category_id,0) 
                  from menu_category where tenant_id=${tenantId} and active=true);`
            let taxMapQuery = `select tg.tenant_id AS tenant_id,tg.id AS taxable_group_id,tg.name AS group_name,tgr.rate_basis 
                  AS rate_basis,tgr.tax_basis AS tax_basis,tr.name AS name,tr.tax_value AS tax_value,tr.tax_inclusive AS tax_inclusive 
                  from ((taxable_group tg join tax_group_rule tgr) join tax_rate tr) 
                  where ((tg.tenant_id = ${tenantId}) and (tg.id = tgr.taxable_group_id) and (tgr.tax_rate_id = tr.id)) order by tg.id;`
            let menuItemProm = new Promise(async (res0, rej0) => {
                try {
                    console.log("menuItemQuery => " + menuItemQuery);
                    await pool.query(menuItemQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  0  ========> " + err);
                            rej0(err)
                        }
                        if (results && results.length > 0) {
                            menuItem = results[0]
                            res0()
                        }
                        else {
                            rej0("No item found")
                        }
                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej0(error)
                }
            });
            let menuOptionProm = new Promise(async (res1, rej1) => {
                try {
                    console.log("menuOptionQuery => " + menuOptionQuery);
                    await pool.query(menuOptionQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  1  ========> " + err);
                            rej1(err)
                        }
                        menuOptions = results
                        res1()
                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej1(error)
                }
            });
            let subCatProm = new Promise(async (res2, rej2) => {
                try {
                    console.log("subCatQuery => " + subCatQuery);
                    await pool.query(subCatQuery, async (err, results, fields) => {
                        if (err) {
                            rej2(err)
                        }
                        subCats = results
                        subCats.forEach(element => {
                            element.taxInclusive = element.taxInclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res2()
                    })
                } catch (error) {
                    rej2(error)
                }
            });
            let taxMapProm = new Promise(async (res3, rej3) => {
                try {
                    console.log("taxMapQuery => " + taxMapQuery);
                    await pool.query(taxMapQuery, async (err, results, fields) => {
                        if (err) {
                            rej3(err)
                        }
                        taxMaps = results
                        taxMaps.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res3()
                    })
                } catch (error) {
                    rej3(error)
                }
            });
            let itemsProm = new Promise(async (res4, rej4) => {
                try {
                    console.log("item Query => " + itemQuery);
                    await pool.query(itemQuery, async (err, results, fields) => {
                        if (err) {
                            rej4(err)
                        }
                        if (results && results.length > 0) {
                            item = results
                            item.forEach(element => {
                                element.allowCustomization = element.allowCustomization.lastIndexOf(1) == -1 ? false : true
                            });
                            res4()
                        }
                        else {
                            rej4("No item found")
                        }
                    })
                } catch (error) {
                    rej4(error)
                }
            });
            promises.push(menuItemProm)
            promises.push(menuOptionProm)
            promises.push(subCatProm)
            promises.push(taxMapProm)
            promises.push(itemsProm)
            Promise.all(promises).then(res => {
                let obj = item[0]
                let childs = lodash.filter(subCats, x => x.id === obj.categoryid);
                if (!childs || childs.length <= 0) {
                    reject("categoty not found")
                    return
                }
                let child = childs[0]
                let rateBasis = 'PCT'
                let taxAmount = 0.0
                let taxCategory = "VAT EXEMPTED";
                child.taxBasis = rateBasis
                child.taxAmount = taxAmount
                child.taxCategory = taxCategory
                if (!child.taxInclusive) {
                    let taxMap = lodash.filter(taxMaps, x => x.taxable_group_id === child.taxablegroupid);
                    taxMap.forEach(tax => {
                        rateBasis = tax.rate_basis
                        taxAmount += tax.tax_value
                        taxCategory = tax.name
                    });
                }
                child.taxBasis = rateBasis
                child.taxAmount = taxAmount
                child.taxCategory = taxCategory
                let tAmount = 0.0;
                let netPrice = 0.0;
                if (rateBasis == "PCT") {
                    tAmount = (taxAmount / 100) * obj.price
                    netPrice = obj.price + tAmount
                }
                else {
                    tAmount = taxAmount;
                    netPrice = obj.price + tAmount
                }
                obj.taxCategory = taxCategory
                obj.taxBasis = rateBasis
                obj.taxAmount = taxAmount
                obj.netPrice = netPrice
                obj.taxValue = tAmount
                menuOptions.push(menuItem)
                menuOptions.forEach(element => {
                    if (rateBasis == "PCT") {
                        tAmount = (taxAmount / 100) * element.addOnPrice
                        netPrice = element.addOnPrice + tAmount
                    }
                    else {
                        tAmount = taxAmount;
                        netPrice = element.addOnPrice + tAmount
                    }
                    element.taxCategory = taxCategory
                    element.taxBasis = rateBasis
                    element.taxAmount = taxAmount
                    element.netPrice = netPrice
                    element.taxValue = tAmount
                });
                var typeArr = {};
                menuOptions.forEach(function (item) {
                    typeArr[item.menuOptionType] = typeArr[item.menuOptionType] || [];
                    typeArr[item.menuOptionType].push(item);
                });
                obj.menuOptions = typeArr
                resolve(obj)
            }).catch(err => {
                console.error("error========> " + err);
                reject(err)
            });
        } catch (error) {
            console.error(error);
            reject(error)
        }
    })
}




export function addDotPeItems(cat, category, items, taxMap: Map<any, any>, profitCenter) {
    if (items) {
        items.forEach(item => {
            // let i = {
            //     id: item.id,
            //     name: item.primary_item_name,
            //     img: item.image,
            //     active: item.active,
            //     price: item.price,
            //     priority: item.priority,
            //     foodType: item.external_reference_no,
            //     tax_inclusive: category.tax_inclusive,
            //     alt_name: item.alt_name,
            //     item_code: item.item_code,
            //     taxes: []
            // }

            let i = {
                itemCode: item.item_code,
                isActive: item.active,
                itemName: item.primary_item_name,
                description: "",
                categoryCode: category.name,
                storeSalesType: "RESTAURANT",
                billingSalesType: [
                    "dine_in",
                    "takeaway",
                    "delivery"]
                ,
                itemRank: item.priority,
                foodType: "VEG",
                price: item.price,
                priceStructure: category.tax_inclusive ? "INC" : "EXC",
                //priceActivationDate: "2020-09-05",
                gst: 0,
                //showroomTakeAwayGST: 5,
                //saleUOM: "POR",
                imageURL: item.image,
                isComboItem: false,
                itemAvailability: [],
                promoDetails: ""
            }



            if (category.taxable_group_id == null && profitCenter &&
                profitCenter.taxable_group_id != null && taxMap.has(profitCenter.taxable_group_id)) {
                taxMap.get(profitCenter.taxable_group_id).forEach(tt => {
                    let t = {
                        tax_rate_id: tt.tax_rate_id,
                        tax_name: tt.name,
                        tax_value: tt.tax_value
                    }
                    i.gst = t.tax_value;
                });
            }
            else {
                if (category.taxable_group_id != null && taxMap.has(category.taxable_group_id)) {
                    taxMap.get(category.taxable_group_id).forEach(tt => {
                        let t = {
                            tax_rate_id: tt.tax_rate_id,
                            tax_name: tt.name,
                            tax_value: tt.tax_value
                        }
                        i.gst = t.tax_value;
                    });
                }
            }
            cat.push(i)
        });
    }
}



export function postMenuToDotPe(tenantId, branchId, pool, orderpool) {

    let dotpeValues;
    let profitCenterId = 0;
    let dotpeQuery = `select * from source_system_mappings where tenant_code='${tenantId}' and our_system_store_code='${branchId}';`
    let categories, parentCats, subCats, taxes, items, profitCenter = null
    return new Promise(async (resolve, reject) => {
        try {
            let promises = [];
            new Promise(async (dpres, dprej) => {
                try {
                    console.log("dotpeQuery => " + dotpeQuery);
                    await orderpool.query(dotpeQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  dotpeQuery  ========> " + err);
                            dprej(err)
                        }
                        if (results && results.length > 0) {
                            dotpeValues = results[0]
                            console.log("dotpeValues => " + JSON.stringify(dotpeValues));

                            dpres()
                        }
                        else {
                            dprej('dotpe values not found')
                        }

                    })
                } catch (error) {
                    console.error("error  dotpeQuery  ========> " + error);
                    dprej(error)
                }
            }).then(res => {
                let codesQuery = `select pc.id as tenantId,b.id as branchId,p.id as profitCenterId from pos_customer pc,branch b,profit_center p where pc.name='${tenantId}' and b.code='${branchId}' and p.name='${dotpeValues.profit_center}' and b.tenant_id=pc.id and p.tenant_id=pc.id;`

                new Promise(async (tres, trej) => {
                    try {
                        console.log("codesQuery => " + codesQuery);
                        await pool.query(codesQuery, async (err, results, fields) => {
                            if (err) {
                                console.error("error  codesQuery  ========> " + err);
                                trej(err)
                            }
                            if (results && results.length > 0) {
                                console.log("codesQuery values => " + JSON.stringify(results[0]));
                                tenantId = results[0].tenantId
                                branchId = results[0].branchId
                                profitCenterId = results[0].profitCenterId
                                tres()
                            }
                            else {
                                trej("Tenant values not found")
                            }

                        })
                    } catch (error) {
                        console.error("error  codesQuery  ========> " + error);
                        trej(error)
                    }
                }).then(res => {
                    let categoriesQuery = `select mc.*,bmc.active as pactive from menu_category mc , branch_profit_center_menu_category bmc  
                                            where mc.tenant_id=${tenantId} 
                                            and bmc.menu_category_id = mc.id
                                            and bmc.branch_id = ${branchId}
                                            and bmc.profit_center_id = ${profitCenterId};`
                    let taxMapQuery = `select tg.tenant_id AS tenant_id,tg.id AS taxable_group_id,tr.id as tax_rate_id,tg.name AS group_name,tgr.rate_basis 
                                        AS rate_basis,tgr.tax_basis AS tax_basis,tr.name AS name,tr.tax_value AS tax_value,tr.tax_inclusive AS tax_inclusive 
                                        from ((taxable_group tg join tax_group_rule tgr) join tax_rate tr) 
                                        where ((tg.tenant_id = ${tenantId}) and (tg.id = tgr.taxable_group_id) and (tgr.tax_rate_id = tr.id)) order by tg.id;`
                    let itemsQuery = `select m.*,mi.name as primary_item_name,mi.external_reference_no,mi.alt_name,mi.item_code,bpmc.price as pprice,bpmc.active as pactive from menu_item mi ,menu m
                                        inner join  
                                        branch_profit_center_menu bpmc ON bpmc.menu_id = m.id
                                        where m.tenant_id=${tenantId} and mi.tenant_id=${tenantId} and m.primary_item_id=mi.id  and bpmc.branch_id=${branchId} and
                                        bpmc.active=true and
                                        bpmc.profit_center_id=${profitCenterId};`
                    let profitCenterQuery = `select * from profit_center where tenant_id=${tenantId} order by id limit 1`


                    let categoriesProm = new Promise(async (res1, rej1) => {
                        try {
                            console.log("categoriesQuery => " + categoriesQuery);
                            await pool.query(categoriesQuery, async (err, results, fields) => {
                                if (err) {
                                    console.error("error  1  ========> " + err);
                                    rej1(err)
                                }
                                categories = results
                                categories.forEach(element => {
                                    element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                                    element.active = element.pactive.lastIndexOf(1) == -1 ? false : true
                                });
                                res1()
                            })
                        } catch (error) {
                            console.error("error  2  ========> " + error);
                            rej1(error)
                        }
                    });
                    let profitCenterProm = new Promise(async (res2, rej2) => {
                        try {
                            console.log("profitCenterQuery => " + profitCenterQuery);
                            await pool.query(profitCenterQuery, async (err, results, fields) => {
                                if (err) {
                                    console.error("error  1  ========> " + err);
                                    rej2(err)
                                }
                                if (results && results.length > 0) {
                                    profitCenter = results[0]
                                }
                                res2()
                            })
                        } catch (error) {
                            console.error("error  2  ========> " + error);
                            rej2(error)
                        }
                    });
                    let taxMapProm = new Promise(async (res3, rej3) => {
                        try {
                            console.log("taxMapQuery => " + taxMapQuery);
                            await pool.query(taxMapQuery, async (err, results, fields) => {
                                if (err) {
                                    rej3(err)
                                }
                                taxes = results
                                taxes.forEach(element => {
                                    element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                                });
                                res3()
                            })
                        } catch (error) {
                            rej3(error)
                        }
                    });
                    let itemsProm = new Promise(async (res4, rej4) => {
                        try {
                            console.log("itemsQuery => " + itemsQuery);
                            await pool.query(itemsQuery, async (err, results, fields) => {
                                if (err) {
                                    rej4(err)
                                }
                                items = results
                                items.forEach(element => {
                                    element.price = element.pprice
                                    element.active = element.pactive.lastIndexOf(1) == -1 ? false : true
                                    element.is_recommended = element.is_recommended.lastIndexOf(1) == -1 ? false : true

                                });
                                res4()
                            })
                        } catch (error) {
                            rej4(error)
                        }
                    });
                    promises.push(categoriesProm)
                    promises.push(taxMapProm)
                    promises.push(itemsProm)
                    promises.push(profitCenterProm)
                    Promise.all(promises).then(res => {
                        parentCats = lodash.filter(categories, x => x.parent_category_id === null);
                        subCats = lodash.filter(categories, x => x.parent_category_id != null);
                        let subCatsMap = new Map()
                        let itemsMap = new Map()
                        let taxMap = new Map()
                        taxes.forEach(function (element) {
                            if (taxMap.has(element.taxable_group_id)) {
                                taxMap.get(element.taxable_group_id).push(element)
                            }
                            else {
                                taxMap.set(element.taxable_group_id, [])
                                taxMap.get(element.taxable_group_id).push(element)
                            }
                        });
                        items.forEach(function (element) {
                            if (itemsMap.has(element.menu_category_id)) {
                                itemsMap.get(element.menu_category_id).push(element)
                            }
                            else {
                                itemsMap.set(element.menu_category_id, [])
                                itemsMap.get(element.menu_category_id).push(element)
                            }
                        });
                        subCats.forEach(element => {
                            if (subCatsMap.has(element.parent_category_id)) {
                                subCatsMap.get(element.parent_category_id).push(element)
                            }
                            else {
                                subCatsMap.set(element.parent_category_id, [])
                                subCatsMap.get(element.parent_category_id).push(element)
                            }
                        });
                        let obj = {
                            groupCode: dotpeValues.their_group_code,
                            companyCode: dotpeValues.their_group_company_code,
                            merchantName: dotpeValues.their_merchant_name,
                            storeData: [
                                {
                                    storeCode: dotpeValues.their_system_store_code,
                                    categories: [],
                                    items: []
                                }
                            ]
                        }
                        parentCats.forEach(parent => {
                            let cat = {
                                isActive: parent.active,
                                categoryRank: parent.priority,
                                parentCategoryCode: parent.name,
                                parentCategoryName: parent.name,
                                categoryCode: "",
                                categoryName: ""
                            }
                            obj.storeData[0].categories.push(cat);
                            if (subCatsMap.has(parent.id)) {
                                subCatsMap.get(parent.id).forEach(child => {
                                    console.log("parent => " + parent.id + " => " + child);
                                })
                                subCatsMap.get(parent.id).forEach(child => {
                                    let subcat = {
                                        isActive: child.active,
                                        categoryRank: parent.priority,
                                        parentCategoryCode: parent.name,
                                        parentCategoryName: parent.name,
                                        categoryCode: child.name,
                                        categoryName: child.name
                                    }
                                    obj.storeData[0].categories.push(subcat);
                                    if (itemsMap.has(child.id)) {
                                        addDotPeItems(obj.storeData[0].items, child, itemsMap.get(child.id), taxMap, profitCenter)
                                    }
                                });
                            }
                            else {
                                if (itemsMap.has(parent.id)) {
                                    addDotPeItems(obj.storeData[0].items, parent, itemsMap.get(parent.id), taxMap, profitCenter)
                                }
                            }
                        });
                        pushDataToDotPe(obj, dotpeValues.authorisation_key)
                            .then(
                                data => {
                                    resolve({ response: data, json: obj })
                                },
                                err => {
                                    reject(err.message)
                                }).catch(err => {

                                    reject(err.message)
                                    return;
                                })
                    }).catch(err => {
                        console.error("error========> " + err);
                        reject(err)
                    });


                }).catch(e => {
                    reject(e)
                })
            }).catch(error => {
                reject(error)
            })
        } catch (error) {
            console.error(error);
            reject(error)
        }
    })
}
export function pushDataToDotPe(data, authKey) {
    return new Promise(async (resolve, reject) => {
        try {
            let options = {
                method: "POST",
                url:
                    `${process.env.dotpeurl}/api/aggregator/merchant/catalog/sync`,
                headers: {
                    "content-type": "application/json",
                    "Authorization": authKey
                },
                body: data,
                json: true
            }
            await request(options, async function (error, response, body) {
                if (error) {
                    reject(error.message)
                    return
                }
                if (response && body && response.statusCode == 200) {
                    resolve(body)
                    return
                }
                else {
                    reject("Something went wrong")
                    return
                }
            })
        } catch (error) {
            reject(error.message)
            return
        }
    });
}