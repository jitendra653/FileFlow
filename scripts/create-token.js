const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET || 'dev_secret';
const argv = process.argv.slice(2);
const id = argv[0] || 'test-user-id';
const token = jwt.sign({ id, email: 'test@example.com' }, secret, { expiresIn: '7d' });
console.log(token);
