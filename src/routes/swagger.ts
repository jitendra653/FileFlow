import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs } from '../config/swagger';

const router = express.Router();

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'File Upload Service API Documentation',
}));

export default router;