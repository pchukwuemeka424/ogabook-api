const jwt = require('jsonwebtoken');

const authenticateAdmin = (req, res, next) => {
  try {
    // Check for token in Authorization header, cookie, or query parameter
    const token = req.headers.authorization?.split(' ')[1] 
      || req.headers['x-auth-token']
      || req.cookies?.admin_token
      || req.query?.token;
    
    console.log('Auth middleware - Path:', req.path, 'Token exists:', !!token);
    
    if (!token) {
      // Check if it's an API request (starts with /api)
      if (req.path.startsWith('/api')) {
        return res.status(401).json({ 
          success: false, 
          message: 'No token provided. Access denied.' 
        });
      }
      // Otherwise redirect to login for web pages
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production');
    req.admin = decoded;
    console.log('Auth successful for:', req.admin.email || req.admin.username);
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    // Check if it's an API request
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token. Access denied.' 
      });
    }
    // Otherwise redirect to login for web pages
    return res.redirect('/login');
  }
};

module.exports = { authenticateAdmin };

