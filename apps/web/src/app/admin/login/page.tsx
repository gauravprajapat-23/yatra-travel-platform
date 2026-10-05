import type { Metadata } from "next";
export const metadata: Metadata = { title: "Admin Login", robots: { index:false, follow:false } };

export default function AdminLoginPage(){
  return <div className="admin-root admin-login-page">
    <section className="admin-login-visual"><div className="admin-login-visual__shade"/><div className="admin-login-visual__content"><strong className="admin-login-brand">YATRA</strong><span>ADMIN PORTAL</span><h1>Manage extraordinary journeys.</h1><p>Bookings. Fleet. Tours. Customers.<br/>All in one unified platform.</p><div className="admin-login-trust"><span>Trusted Operations</span><span>Secure Access</span><span>Built for Growth</span></div></div></section>
    <section className="admin-login-form-wrap"><form className="admin-login-form"><h2>Welcome Back</h2><p>Sign in to your YATRA admin account to continue.</p><label>Email Address<input type="email" defaultValue="admin@yatra.com"/></label><label>Password<input type="password" defaultValue="password123"/></label><div className="admin-login-options"><label><input type="checkbox" defaultChecked/> Remember me</label><a href="#">Forgot password?</a></div><button className="admin-primary-button admin-login-submit" type="button">Sign In →</button><div className="admin-login-divider"><span>or continue with</span></div><button className="admin-google-button" type="button">G&nbsp;&nbsp; Sign in with Google</button><small>Secure. Reliable. Always on the move.</small></form></section>
  </div>;
}
