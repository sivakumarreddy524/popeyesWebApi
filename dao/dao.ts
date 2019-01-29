const lodash = require('lodash')
let tenantId = process.env.tenantid
let defaultTaxGroup = process.env.defaultTaxGroup


console.log("tenantId  =====> " + tenantId);


let parentCatQuery = `select id,name,image from menu_category where tenant_id=${tenantId} and id in 
(select distinct IFNULL(parent_category_id,0) from menu_category where tenant_id=${tenantId} and active=true) order by name;`


let subCatQuery = `select id,parent_category_id as categoryid,name as header,last_updated as lastUpdated,
date_created as dateCreated, 
    null as taxCategory,tax_inclusive as taxInclusive,null as taxBasis, null as taxAmount,
    case when taxable_group_id is null then ${defaultTaxGroup} else taxable_group_id end as taxablegroupid
    from menu_category mc where tenant_id=${tenantId} and active=true and id not in (select distinct IFNULL(parent_category_id,0) 
    from menu_category where tenant_id=${tenantId} and active=true);`

let taxMapQuery = `select tg.tenant_id AS tenant_id,tg.id AS taxable_group_id,tg.name AS group_name,tgr.rate_basis 
AS rate_basis,tgr.tax_basis AS tax_basis,tr.name AS name,tr.tax_value AS tax_value,tr.tax_inclusive AS tax_inclusive 
from ((taxable_group tg join tax_group_rule tgr) join tax_rate tr) 
where ((tg.tenant_id = ${tenantId}) and (tg.id = tgr.taxable_group_id) and (tgr.tax_rate_id = tr.id)) order by tg.id;`


let itemsQuery = `select id,menu_category_id as categoryid,image as img, name as lable , allow_customization as 
    allowCustomization,no_of_drinks as noOfDrinks,no_of_side_items as noOfSides,1 as mains
    ,price, 'AED' as currency,null as 'desc' ,last_updated as lastUpdated,date_created as dateCreated,
    null as taxCategory,null as taxBasis,null as taxAmount, null as netPrice,null as taxValue 
    from menu where tenant_id=${tenantId} and active=true;`

export function getCategories(pool) {

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
                            rej1("Something went wrong!!! Please try again later...1")

                        }

                        parentCats = results
                        res1()


                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej1("Something went wrong!!! Please try again later...1")
                }
            });

            let subCatProm = new Promise(async (res2, rej2) => {
                try {
                    console.log("subCatQuery => " + subCatQuery);

                    await pool.query(subCatQuery, async (err, results, fields) => {
                        if (err) {
                            rej2("Something went wrong!!! Please try again later...2")

                        }

                        subCats = results

                        subCats.forEach(element => {
                            element.taxInclusive = element.taxInclusive.lastIndexOf(1) == -1 ? false : true
                        });

                        res2()


                    })
                } catch (error) {
                    rej2("Something went wrong!!! Please try again later...2")
                }
            });

            let taxMapProm = new Promise(async (res3, rej3) => {
                try {
                    console.log("taxMapQuery => " + taxMapQuery);

                    await pool.query(taxMapQuery, async (err, results, fields) => {
                        if (err) {
                            rej3("Something went wrong!!! Please try again later...3")
                        }
                        taxMaps = results
                        taxMaps.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res3()
                    })
                } catch (error) {
                    rej3("Something went wrong!!! Please try again later...3")
                }
            });


            let itemsProm = new Promise(async (res4, rej4) => {
                try {
                    console.log("itemsQuery => " + itemsQuery);

                    await pool.query(itemsQuery, async (err, results, fields) => {
                        if (err) {
                            rej4("Something went wrong!!! Please try again later...4")
                        }
                        items = results
                        items.forEach(element => {
                            element.allowCustomization = element.allowCustomization.lastIndexOf(1) == -1 ? false : true
                        });
                        res4()
                    })
                } catch (error) {
                    rej4("Something went wrong!!! Please try again later...4")
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

                reject("Something went wrong!!! Please try again later...")
            });




        } catch (error) {
            console.error(error);
            reject("Something went wrong!!! Please try again later...")
        }
    })
}



export function getItem(id: number, pool) {

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


            let menuItemQuery = `select 'MAIN' as menuOptionType,0 as seq,mi.price as addOnPrice,1 as qty,mi.name as menuItemName,
             mi.id as menuItemId,mi.image as imageName,null as 'desc',null as taxCategory,null as taxBasis,0 as taxAmount,
             0 as netPrice,0 as taxValue
              from menu m,menu_item mi where m.tenant_id=6 and mi.tenant_id=${tenantId} 
              and m.primary_item_id=mi.id and m.active=true and m.id=${id};`


            let menuItemProm = new Promise(async (res0, rej0) => {
                try {
                    console.log("menuItemQuery => " + menuItemQuery);

                    await pool.query(menuItemQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  0  ========> " + err);
                            rej0("Something went wrong!!! Please try again later...0")

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
                    rej0("Something went wrong!!! Please try again later...1")
                }
            });


            let menuOptionProm = new Promise(async (res1, rej1) => {
                try {
                    console.log("menuOptionQuery => " + menuOptionQuery);

                    await pool.query(menuOptionQuery, async (err, results, fields) => {
                        if (err) {
                            console.error("error  1  ========> " + err);
                            rej1("Something went wrong!!! Please try again later...1")

                        }

                        menuOptions = results
                        res1()


                    })
                } catch (error) {
                    console.error("error  2  ========> " + error);
                    rej1("Something went wrong!!! Please try again later...1")
                }
            });




            let subCatProm = new Promise(async (res2, rej2) => {
                try {
                    console.log("subCatQuery => " + subCatQuery);

                    await pool.query(subCatQuery, async (err, results, fields) => {
                        if (err) {
                            rej2("Something went wrong!!! Please try again later...2")

                        }

                        subCats = results

                        subCats.forEach(element => {
                            element.taxInclusive = element.taxInclusive.lastIndexOf(1) == -1 ? false : true
                        });

                        res2()


                    })
                } catch (error) {
                    rej2("Something went wrong!!! Please try again later...2")
                }
            });

            let taxMapProm = new Promise(async (res3, rej3) => {
                try {
                    console.log("taxMapQuery => " + taxMapQuery);

                    await pool.query(taxMapQuery, async (err, results, fields) => {
                        if (err) {
                            rej3("Something went wrong!!! Please try again later...3")
                        }
                        taxMaps = results
                        taxMaps.forEach(element => {
                            element.tax_inclusive = element.tax_inclusive.lastIndexOf(1) == -1 ? false : true
                        });
                        res3()
                    })
                } catch (error) {
                    rej3("Something went wrong!!! Please try again later...3")
                }
            });


            let itemsProm = new Promise(async (res4, rej4) => {
                try {
                    console.log("item Query => " + itemQuery);

                    await pool.query(itemQuery, async (err, results, fields) => {
                        if (err) {
                            rej4("Something went wrong!!! Please try again later...4")
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
                    rej4("Something went wrong!!! Please try again later...4")
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
            reject("Something went wrong!!! Please try again later...")
        }
    })



}








