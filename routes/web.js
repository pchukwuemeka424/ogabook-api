const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/supabase');

// Helper function to verify token from query or skip for web pages
const optionalAuth = (req, res, next) => {
  const token = req.query.token || req.cookies?.admin_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production');
      req.admin = decoded;
    } catch (error) {
      // Token invalid, continue without admin
    }
  }
  next();
};

// Login page
router.get('/login', (req, res) => {
  res.render('login', { title: 'Admin Login' });
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.redirect('/login');
});

// Dashboard - requires authentication
router.get('/dashboard', (req, res) => {
  // Client-side will handle auth, but we can still render the page
  // The page will redirect to login if no token in localStorage
  res.render('dashboard', { 
    title: 'Dashboard',
    admin: {} // Pass empty object so layout renders
  });
});

// Root - check for subscription parameters or redirect to dashboard
router.get('/', optionalAuth, async (req, res) => {
  // Check if subscription parameters are present
  const { userId, status, package: pkg, billingCycle, amount } = req.query;
  
  if (userId && pkg && amount) {
    try {
      // Fetch user details from database
      const userResult = await pool.query(
        'SELECT id, email, phone FROM users WHERE id = $1',
        [userId]
      );

      let userEmail = '';
      let userPhone = '';

      if (userResult.rows.length > 0) {
        userEmail = userResult.rows[0].email || '';
        userPhone = userResult.rows[0].phone || '';
      }

      // Render subscription page with parameters
      res.render('subscription', {
        title: 'Subscription - OgaBook',
        userId: userId,
        userEmail: userEmail,
        userPhone: userPhone,
        status: status || 'pending',
        package: pkg,
        billingCycle: billingCycle || 'monthly',
        amount: amount
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      // Still render the page even if user fetch fails
      res.render('subscription', {
        title: 'Subscription - OgaBook',
        userId: userId,
        userEmail: '',
        userPhone: '',
        status: status || 'pending',
        package: pkg,
        billingCycle: billingCycle || 'monthly',
        amount: amount
      });
    }
  } else {
    // No subscription parameters, redirect to dashboard
  res.redirect('/dashboard');
  }
});

// Users management page
router.get('/users', optionalAuth, (req, res) => {
  res.render('users', { 
    title: 'Users Management',
    admin: req.admin || {}
  });
});

// Subscriptions management page
router.get('/subscriptions', optionalAuth, (req, res) => {
  res.render('subscriptions', { 
    title: 'Subscriptions Management',
    admin: req.admin || {}
  });
});

// Subscription Packages management page
router.get('/subscription-packages', optionalAuth, (req, res) => {
  res.render('subscription-packages', { 
    title: 'Subscription Packages Management',
    admin: req.admin || {}
  });
});

// All tables management page
router.get('/tables', optionalAuth, (req, res) => {
  res.render('tables', { 
    title: 'Database Tables',
    admin: req.admin || {}
  });
});

// Table data viewer
router.get('/tables/:tableName', optionalAuth, (req, res) => {
  res.render('table-viewer', { 
    title: `Table: ${req.params.tableName}`,
    tableName: req.params.tableName,
    admin: req.admin || {}
  });
});

// Delete Account Page (Public - no auth required)
router.get('/delete-account', (req, res) => {
  res.render('delete-account', { 
    title: 'Delete Account'
  });
});

// Account Deleted Success Page (Public - no auth required)
router.get('/account-deleted', (req, res) => {
  res.render('account-deleted', { 
    title: 'Account Deleted Successfully'
  });
});

// Payment success page
router.get('/payment/success', (req, res) => {
  const { txRef, transactionId, userId, package: pkg, billingCycle, amount } = req.query;
  res.render('payment-success', {
    title: 'Payment Successful - OgaBook',
    txRef: txRef || '',
    transactionId: transactionId || '',
    userId: userId || '',
    package: pkg || '',
    billingCycle: billingCycle || '',
    amount: amount || ''
  });
});

// Payment cancelled page
router.get('/payment/cancelled', (req, res) => {
  const { txRef, userId, package: pkg, billingCycle, amount } = req.query;
  res.render('payment-cancelled', {
    title: 'Payment Cancelled - OgaBook',
    txRef: txRef || '',
    userId: userId || '',
    package: pkg || '',
    billingCycle: billingCycle || '',
    amount: amount || ''
  });
});

// Payment failed page
router.get('/payment/failed', (req, res) => {
  const { txRef, transactionId, userId, package: pkg, billingCycle, amount } = req.query;
  res.render('payment-failed', {
    title: 'Payment Failed - OgaBook',
    txRef: txRef || '',
    transactionId: transactionId || '',
    userId: userId || '',
    package: pkg || '',
    billingCycle: billingCycle || '',
    amount: amount || ''
  });
});

// Catch-all for undefined routes - redirect to login
router.get('*', (req, res) => {
  res.redirect('/login');
});

module.exports = router;

