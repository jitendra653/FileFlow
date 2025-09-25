import { header, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const checkCategory = [
  header('x-category').optional().isString().isLength({ max: 50 }),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];
export default  checkCategory;