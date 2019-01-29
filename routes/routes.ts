const express = require('express')
import * as dao from "../dao/dao";

const lodash = require('lodash')







export default function setRoutes(app, pool) {
    const router = express.Router();


    router.route('/categories').get(async (req, res) => {
        try {
            dao.getCategories(pool).then(
                resp => {
                    res.status(200).json(resp);
                },
                err => {
                    res.status(500).json({
                        status: 'error',
                        error: err
                    });
                })
                .catch(e => {
                    res.status(500).json({
                        status: 'error',
                        error: e
                    });
                });

        } catch (error) {
            // logger.error(error);
            res.status(500).json({
                status: 'error',
                error: error.message
            });

        }


    })



    router.route('/item/:id').get(async (req, res) => {


        var id = req.params.id;


        if (id) {
            try {
                dao.getItem(id,pool).then(
                    resp => {
                        res.status(200).json(resp);
                    },
                    err => {
                        res.status(500).json({
                            status: 'error',
                            error: err
                        });
                    })
                    .catch(e => {
                        res.status(500).json({
                            status: 'error',
                            error: e
                        });
                    });

            } catch (error) {
                // logger.error(error);
                res.status(500).json({
                    status: 'error',
                    error: error.message
                });

            }
        }
        else {
            res.status(500).json({
                status: 'error',
                error: 'id not found',
            });
        }




    })

    app.use(router)



}