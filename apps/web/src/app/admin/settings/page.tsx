import { AdminShell } from "@/components/admin-shell";

export default function SettingsPage(){
 return <AdminShell active="Settings" title="Settings" subtitle="Manage your platform configuration, integrations and preferences." actions={<button className="admin-primary-button">Save Changes</button>}>
   <div className="admin-tabs-bar">{["Business Info","Pricing Rules","Notifications","Integrations","Payments","Security"].map((x,i)=><button className={i===0?"is-active":""} key={x}>{x}</button>)}</div>
   <div className="admin-settings-grid">
     <section className="admin-panel admin-card-body"><h2>Business Information</h2><label>Business Name<input defaultValue="YATRA Travel Solutions"/></label><label>Email Address<input defaultValue="support@yatra.com"/></label><label>Contact Number<input defaultValue="+91 98765 43210"/></label><label>Address<textarea defaultValue="123 Travel Street, Connaught Place, New Delhi - 110001, India"/></label><label>Website URL<input defaultValue="https://www.yatra.com"/></label><h3>Company Details</h3><label>GST Number<input defaultValue="07ABCDE1234F1Z5"/></label><label>PAN Number<input defaultValue="ABCDE1234F"/></label></section>
     <section className="admin-panel admin-card-body"><h2>Brand & Appearance</h2><div className="admin-color-field"><span>Primary Color</span><b style={{background:"#F97316"}}/><code>#F97316</code></div><div className="admin-color-field"><span>Secondary Color</span><b style={{background:"#0F4D3A"}}/><code>#0F4D3A</code></div><div className="admin-color-field"><span>Accent Color</span><b style={{background:"#F59E0B"}}/><code>#F59E0B</code></div><label>Timezone<select><option>(GMT+05:30) Asia/Kolkata</option></select></label><label>Date Format<select><option>DD MMM YYYY</option></select></label><label>Currency<select><option>INR (₹) - Indian Rupee</option></select></label><h3>Social Media</h3><label>Facebook<input defaultValue="https://facebook.com/yatra"/></label><label>Instagram<input defaultValue="https://instagram.com/yatra"/></label><label>YouTube<input defaultValue="https://youtube.com/@yatra"/></label></section>
   </div>
 </AdminShell>;
}
