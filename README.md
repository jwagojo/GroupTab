# GroupTab 📁 - Split Expenses with Friends

A modern, production-ready web application for splitting expenses and calculating settlements between friends, roommates, and travel groups.

## 🎯 Key Features

- **Smart Settlement Logic**: Advanced algorithm to calculate "who owes who" across multiple receipts
- **Real-time Collaboration**: Share trips with unique invite codes and track expenses together
- **Customizable Themes**: Personalize trip covers and receipt designs
- **Receipt Management**: Upload receipt photos and add items with automatic calculations
- **Multi-location Support**: Track expenses from different locations within a single trip
- **Secure Authentication**: Google Sign-in with Firebase
- **PDF Export**: Print or export settlement summaries

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite (modern, fast builds)
- **Backend**: Flask (Python) - Serverless on Vercel
- **Database**: Firebase Firestore (real-time, scalable)
- **Auth**: Firebase Authentication with Google Provider
- **Hosting**: Vercel (frontend + backend)

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- Python 3.9+
- Firebase project account
- Vercel account (for deployment)

## 🚀 Getting Started

### 1. Local Development Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd GroupTab

# Setup backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Setup frontend
cd frontend
npm install
cd ..
```

### 2. Configure Environment Variables

#### Frontend (.env)
```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env` with your Firebase credentials:
```
VITE_API_KEY=your_firebase_api_key
VITE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_PROJECT_ID=your-project-id
VITE_STORAGE_BUCKET=your-project.appspot.com
VITE_MESSAGING_SENDER_ID=your_sender_id
VITE_APP_ID=your_app_id
```

#### Backend (.env)
```bash
cp .env.example .env
```

Edit `.env`:
```
FLASK_ENV=development
CORS_ORIGINS=http://localhost:3000
```

### 3. Run Locally

```bash
# Terminal 1: Backend
source venv/bin/activate
python -m flask --app api/index run --port 5000

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173`

## 📦 Production Deployment

### Deploy to Vercel (Recommended)

1. **Connect Repository**
   - Push code to GitHub/GitLab
   - Connect to Vercel dashboard

2. **Set Environment Variables**
   - Add all Firebase credentials to Vercel project settings
   - Add `CORS_ORIGINS` with your production domain

3. **Deploy**
   ```bash
   npm install -g vercel
   vercel
   ```

### Manual Deployment Checklist

- [ ] Set `FLASK_ENV=production` on Vercel
- [ ] Update `CORS_ORIGINS` to production domain
- [ ] Configure Firebase security rules for production
- [ ] Enable HTTPS on custom domain
- [ ] Set up monitoring and error tracking
- [ ] Review security headers (included in vercel.json)
- [ ] Test payment flows and calculations

## 🔒 Security Features

✅ **Implemented:**
- Secure environment variable management
- CORS protection
- Rate limiting (30 requests/minute on /api/calculate)
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Input validation on all API endpoints
- HTTP-only Firebase auth tokens
- No console logs in production builds

## 🎨 Customization

### Theme Colors
Edit `frontend/src/App.css` CSS variables:
```css
:root {
  --primary: #0891b2;      /* Teal */
  --secondary: #3b82f6;    /* Blue */
  --bg-deep: #0f172a;      /* Background */
}
```

### Feature Flags
Toggle features in `frontend/.env`:
```
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
```

## 📊 Settlement Algorithm

The backend uses a proven algorithm to calculate fair settlements:
1. Aggregates all expenses by person
2. Calculates net balances
3. Optimizes settlement transactions (fewer, cleaner payments)
4. Returns who owes whom and how much

## 🧪 Testing

```bash
# Frontend
cd frontend
npm run lint
npm run build  # Test production build

# Backend
python -m pytest  # if tests added
```

## 🐛 Troubleshooting

**CORS errors?**
- Check `CORS_ORIGINS` in backend config
- Verify frontend URL matches allowed origin

**Firebase auth not working?**
- Verify Firebase credentials in .env
- Check Google OAuth redirect URLs in Firebase console
- Ensure Firestore rules allow access

**Backend timeout?**
- Increase `maxDuration` in vercel.json if needed
- Check backend logs: `vercel logs`

**Build failing?**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version: `node --version` (should be 18+)

## 📈 Monitoring & Logs

```bash
# View Vercel logs
vercel logs

# Local backend logs (development)
# Check console output in terminal

# Frontend errors
# Browser DevTools Console (F12)
```

## 📝 Code Structure

```
GroupTab/
├── api/
│   ├── index.py          # Flask backend
│   └── settlement.py     # Calculation logic
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main component
│   │   ├── App.css       # Styling
│   │   ├── firebase.js   # Firebase config
│   │   └── main.jsx      # Entry point
│   ├── index.html
│   └── vite.config.js
├── vercel.json          # Deployment config
├── requirements.txt     # Python dependencies
└── README.md
```

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Issues: GitHub Issues
- Documentation: See docs/ folder
- Email: support@grouptab.app

## 🎉 What's Next?

Planned features:
- [ ] Mobile app (React Native)
- [ ] Recurring expense tracking
- [ ] Payment integration (Stripe/PayPal)
- [ ] Group analytics and charts
- [ ] Multi-currency support
- [ ] Email notifications

---

**Built with ❤️ for making expense-splitting simple and fair.**

