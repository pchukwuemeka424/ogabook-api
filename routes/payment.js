const express = require('express');
const router = express.Router();

// Flutterwave API credentials
const FLW_PUBLIC_KEY = (process.env.FLUTTERWAVE_PUBLIC_KEY || 'FLWPUBK-ba003e1f0a74b96434f86559c413856c-X').trim();
const FLW_SECRET_KEY = (process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK-a64bd86f3c9a80a2b710331ba70cca28-19a7d7101b1vt-X').trim();
const FLW_ENCRYPTION_KEY = (process.env.FLUTTERWAVE_ENCRYPTION_KEY || 'a64bd86f3c9a0c3521bc35c0').trim();
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

// Initialize Flutterwave Payment
router.post('/initialize', async (req, res) => {
  try {
    const { userId, userEmail, userPhone, package: pkg, billingCycle, amount, status } = req.body;

    // Validate required fields
    if (!userId || !userEmail || !amount || !pkg) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment parameters'
      });
    }

    // Generate unique transaction reference
    const txRef = `OGABOOK-${userId}-${Date.now()}`;

    // Payment data
    const paymentData = {
      tx_ref: txRef,
      amount: parseFloat(amount),
      currency: 'NGN',
      redirect_url: `${req.protocol}://${req.get('host')}/payment/callback?userId=${userId}&package=${encodeURIComponent(pkg)}&billingCycle=${encodeURIComponent(billingCycle || 'monthly')}&amount=${amount}&status=${status || 'pending'}`,
      payment_options: 'card, banktransfer, ussd, mobilemoney',
      customer: {
        email: userEmail,
        phone_number: userPhone || '',
        name: `User ${userId.substring(0, 8)}`
      },
      customizations: {
        title: 'OgaBook Subscription Payment',
        description: `${pkg.toUpperCase()} Package - ${billingCycle || 'monthly'} billing`,
        logo: `${req.protocol}://${req.get('host')}/assets/logo.png`
      },
      meta: {
        userId: userId,
        package: pkg,
        billingCycle: billingCycle || 'monthly',
        status: status || 'pending'
      }
    };

    // Validate secret key format
    if (!FLW_SECRET_KEY || !FLW_SECRET_KEY.startsWith('FLWSECK-')) {
      console.error('Invalid Flutterwave Secret Key format');
      return res.status(500).json({
        success: false,
        message: 'Invalid Flutterwave Secret Key configuration. Please check your .env file.',
        error: 'Secret key must start with FLWSECK-'
      });
    }

    // Make request to Flutterwave API
    const authHeader = `Bearer ${FLW_SECRET_KEY}`;
    console.log('Flutterwave API Request:', {
      url: `${FLW_BASE_URL}/payments`,
      authHeaderPrefix: authHeader.substring(0, 20) + '...',
      hasSecretKey: !!FLW_SECRET_KEY
    });

    const response = await fetch(`${FLW_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Flutterwave response:', responseText);
      return res.status(500).json({
        success: false,
        message: 'Invalid response from Flutterwave API',
        error: responseText.substring(0, 200)
      });
    }

    if (response.status === 401 || response.status === 403) {
      console.error('Flutterwave Authentication Error:', data);
      return res.status(401).json({
        success: false,
        message: 'Invalid Flutterwave authorization key. Please verify your secret key in the .env file.',
        error: data.message || 'Unauthorized'
      });
    }

    if (data.status === 'success' && data.data && data.data.link) {
      res.json({
        success: true,
        paymentLink: data.data.link,
        txRef: txRef
      });
    } else {
      console.error('Flutterwave API Error:', data);
      res.status(500).json({
        success: false,
        message: data.message || 'Failed to initialize payment',
        error: data
      });
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing payment',
      error: error.message
    });
  }
});

// Payment callback handler
router.get('/callback', (req, res) => {
  const { status, tx_ref, transaction_id } = req.query;
  const { userId, package: pkg, billingCycle, amount, status: subStatus } = req.query;

  if (status === 'successful') {
    // Payment successful - redirect to success page
    res.redirect(`/payment/success?txRef=${tx_ref}&transactionId=${transaction_id}&userId=${userId}&package=${encodeURIComponent(pkg)}&billingCycle=${encodeURIComponent(billingCycle)}&amount=${amount}`);
  } else if (status === 'cancelled') {
    // Payment cancelled by user
    res.redirect(`/payment/cancelled?txRef=${tx_ref}&userId=${userId}&package=${encodeURIComponent(pkg)}&billingCycle=${encodeURIComponent(billingCycle)}&amount=${amount}`);
  } else {
    // Payment failed
    res.redirect(`/payment/failed?txRef=${tx_ref}&transactionId=${transaction_id || ''}&userId=${userId}&package=${encodeURIComponent(pkg)}&billingCycle=${encodeURIComponent(billingCycle)}&amount=${amount}`);
  }
});

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const { txRef } = req.body;

    if (!txRef) {
      return res.status(400).json({
        success: false,
        message: 'Transaction reference is required'
      });
    }

    // Validate secret key
    if (!FLW_SECRET_KEY || !FLW_SECRET_KEY.startsWith('FLWSECK-')) {
      return res.status(500).json({
        success: false,
        message: 'Invalid Flutterwave Secret Key configuration'
      });
    }

    // Verify payment with Flutterwave
    const response = await fetch(`${FLW_BASE_URL}/transactions/${txRef}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FLW_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.status === 'success' && data.data.status === 'successful') {
      res.json({
        success: true,
        message: 'Payment verified successfully',
        transaction: data.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: data
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
});

module.exports = router;

