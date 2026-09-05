const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');

function getTokenFromRequest(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }

  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (!name) return acc;
    acc[name.trim()] = rest.join('=').trim();
    return acc;
  }, {});

  return cookies.admin_token || null;
}

function verifyJwt(token) {
  const secrets = [...new Set(
    [process.env.JWT_SECRET, 'default_jwt_secret', 'your-secret-key'].filter(Boolean)
  )];

  let lastError = null;
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Invalid token');
}

function authMiddleware(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' });
  }

  try {
    req.user = verifyJwt(token);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

async function adminAuthMiddleware(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // First try to find in new Admin model
    let admin = await Admin.findById(decoded.id);
    
    // If not found in Admin model, try old User model for backward compatibility
    if (!admin) {
      const user = await User.findById(decoded.id);
      if (user && (user.isAdmin === true || user.role === 'admin' || user.role === 'superadmin')) {
        // Create a temporary admin-like object from the user
        admin = {
          _id: user._id,
          phone: user.phone,
          role: user.role === 'superadmin' ? 'super_admin' : 'admin',
          fullName: user.username || user.phone,
          email: user.email || `${user.phone}@bit90.com`,
          status: 'active'
        };
      }
    }
    
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }
    
    if (admin.status !== 'active') {
      return res.status(403).json({ message: 'Admin account is not active' });
    }
    
    // Add admin details to request
    req.user = {
      id: admin._id,
      phone: admin.phone,
      role: admin.role,
      fullName: admin.fullName,
      email: admin.email
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = {
  authMiddleware,
  adminAuthMiddleware,
  getTokenFromRequest
};
