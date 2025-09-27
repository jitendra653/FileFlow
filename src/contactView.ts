import { Router } from 'express';

const contactViewRouter = Router();

contactViewRouter.get('/contact', (req, res) => {
  res.render('contactus', { success: null, error: null });
});

export default contactViewRouter;
