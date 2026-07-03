# HR System - MERN Stack

A comprehensive Human Resources Management System built with MongoDB, Express.js, React, and Node.js.

## Features

- **Employee Dashboard**: Welcome page with quick stats and actions
- **Attendance Management**: Check-in/Check-out system with work mode selection
- **Leave Management**: Apply for leaves, track leave balance, approvals
- **Salary & Payslips**: View salary details and download payslips
- **Announcements**: Company-wide announcements and updates
- **Expense Management**: Claim expenses with approval workflow
- **User Authentication**: Secure login and registration system
- **Role-Based Access**: Different permissions for employees, managers, and admins

## Project Structure

```
Hr system/
├── backend/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── models/                  # MongoDB schemas
│   │   ├── User.js
│   │   ├── Leave.js
│   │   ├── Attendance.js
│   │   ├── Payslip.js
│   │   ├── Expense.js
│   │   ├── Announcement.js
│   │   ├── Document.js
│   │   └── Holiday.js
│   ├── controllers/             # Business logic
│   │   ├── authController.js
│   │   ├── leaveController.js
│   │   ├── attendanceController.js
│   │   ├── payslipController.js
│   │   ├── expenseController.js
│   │   └── announcementController.js
│   ├── routes/                  # API endpoints
│   │   ├── authRoutes.js
│   │   ├── leaveRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── payslipRoutes.js
│   │   ├── expenseRoutes.js
│   │   └── announcementRoutes.js
│   ├── middleware/
│   │   └── auth.js              # Authentication middleware
│   ├── uploads/                 # File uploads directory
│   ├── .env                     # Environment variables
│   ├── server.js                # Main server file
│   └── package.json
│
└── frontend/
    ├── public/
    │   ├── index.html
    │   └── manifest.json
    ├── src/
    │   ├── components/
    │   │   ├── Header.js
    │   │   ├── Header.css
    │   │   ├── Sidebar.js
    │   │   └── Sidebar.css
    │   ├── pages/
    │   │   ├── Login.js
    │   │   ├── Login.css
    │   │   ├── Dashboard.js
    │   │   ├── Dashboard.css
    │   │   ├── Leave.js
    │   │   ├── Leave.css
    │   │   ├── Announcements.js
    │   │   ├── Announcements.css
    │   │   ├── Salary.js
    │   │   └── Salary.css
    │   ├── services/
    │   │   └── api.js           # API calls configuration
    │   ├── context/
    │   │   └── AuthContext.js   # Authentication state management
    │   ├── styles/
    │   ├── App.js
    │   ├── App.css
    │   ├── index.js
    │   └── index.css
    ├── package.json
    └── .gitignore

```

## Installation

### Prerequisites
- Node.js (v14+)
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. Navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hr_system
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
```

4. Start the server:
```bash
npm run dev
```
Server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the React development server:
```bash
npm start
```
Application will open at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Attendance
- `POST /api/attendance/check-in` - Check in
- `POST /api/attendance/check-out` - Check out
- `GET /api/attendance` - Get attendance records

### Leave
- `GET /api/leaves` - Get all leaves
- `GET /api/leaves/employee/:id` - Get employee leaves
- `POST /api/leaves` - Create leave request
- `PUT /api/leaves/:id` - Update leave status
- `DELETE /api/leaves/:id` - Delete leave

### Payslip
- `GET /api/payslips` - Get payslips
- `POST /api/payslips` - Create payslip
- `PUT /api/payslips/:id` - Update payslip

### Expense
- `GET /api/expenses` - Get expenses
- `POST /api/expenses` - Create expense claim
- `PUT /api/expenses/:id` - Approve/Reject expense

### Announcements
- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement
- `PUT /api/announcements/:id` - Update announcement
- `DELETE /api/announcements/:id` - Delete announcement

## Testing Credentials

For testing, use these sample credentials:
- Email: `emp@example.com`
- Password: `password123`

(You'll need to register a test user first via the registration endpoint)

## Technologies Used

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing

### Frontend
- **React** - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Context API** - State management
- **CSS3** - Styling

## Future Enhancements

- [ ] Add more pages (Attendance details, Documents, Holidays)
- [ ] Expense management with receipts
- [ ] Document management system
- [ ] Holiday calendar
- [ ] Employee exit/resignation workflow
- [ ] Email notifications
- [ ] PDF payslip generation
- [ ] Admin dashboard with analytics
- [ ] Performance review system
- [ ] Mobile app
- [ ] Two-factor authentication

## Development Guidelines

### Backend
- All API responses follow standard JSON format
- Authentication uses JWT tokens in Authorization header
- Database models are in `/models` directory
- Business logic in `/controllers` directory
- Routes in `/routes` directory

### Frontend
- Component-based architecture
- CSS modules for styling
- API calls through services layer
- Context API for state management
- Responsive design with media queries

## License

MIT License

## Support

For issues and questions, please create an issue in the repository.
