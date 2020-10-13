const express = require('express')
import * as dao from "../dao/dao";
const lodash = require('lodash')
export default function setRoutes(app, pool, orderpool) {
    const router = express.Router();
    router.route('/categories').get(async (req, res) => {
        let tenantId = req.query.tenantId
        if (!tenantId) {
            res.status(500).json({
                status: 'error',
                error: 'Parameter not found'
            });
            return
        }
        try {
            dao.getCategories(tenantId, pool).then(
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
        var tenantId = req.query.tenantId;
        if (id && tenantId) {
            try {
                dao.getItem(tenantId, id, pool).then(
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
                error: 'parameter not found',
            });
        }
    })
    router.route('/uploadToDotPe').get(async (req, res) => {
        let tenantId = req.query.tenantCode
        let branchId = req.query.branchCode

        if (!tenantId || !branchId) {
            res.status(500).json({
                status: 'error',
                error: 'Parameter not found'
            });
            return
        }
        try {
            dao.postMenuToDotPe(tenantId, branchId, pool, orderpool).then(
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
    router.route('/menu').get(async (req, res) => {
        let tenantId = req.query.tenantId
        // let profitCenterId = req.query.profitCenterId
        if (!tenantId) {
            res.status(500).json({
                status: 'error',
                error: 'Parameter not found'
            });
            return
        }
        try {
            dao.getMenu(tenantId, pool).then(
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
    router.route('/menuByProfitCenter').get(async (req, res) => {
        let tenantId = req.query.tenantId
        let branchId = req.query.branchId
        let profitCenterId = req.query.profitCenterId
        // let profitCenterId = req.query.profitCenterId
        if (!tenantId || !branchId || !profitCenterId) {
            res.status(500).json({
                status: 'error',
                error: 'Parameter not found'
            });
            return
        }
        try {
            dao.getMenuByProfitCenter(tenantId, branchId, profitCenterId, pool).then(
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
    app.use(router)
}