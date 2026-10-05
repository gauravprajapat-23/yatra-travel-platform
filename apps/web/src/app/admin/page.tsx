import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";

export default function AdminDashboardPage(){
 return <AdminShell active="Dashboard" title="Dashboard" subtitle="Welcome back! Here’s what’s happening with your business today.">
   <div className="admin-metric-grid">
     <AdminMetric label="Total Bookings" value="128" meta="↑ 12% vs last week" tone="green"/>
     <AdminMetric label="Total Revenue" value="₹ 12,48,000" meta="↑ 18% vs last week" tone="orange"/>
     <AdminMetric label="Active Trips" value="24" meta="↑ 9% on road" tone="green"/>
     <AdminMetric label="Pending Leads" value="38" meta="↓ 5% need follow-up" tone="red"/>
   </div>
   <div className="admin-dashboard-grid">
     <section className="admin-panel admin-chart-panel"><div className="admin-panel-heading"><h2>Bookings Trend</h2><span>Last 7 Days⌄</span></div><div className="admin-chart"><div className="admin-bars">{[36,58,42,66,51,78,83].map((h,i)=><span key={i} style={{height:`${h}%`}}/>)}</div><svg viewBox="0 0 700 180" preserveAspectRatio="none" aria-hidden><polyline points="0,145 115,95 230,120 345,70 460,91 575,42 700,32" fill="none" stroke="#f26b1d" strokeWidth="5"/></svg></div></section>
     <section className="admin-panel"><div className="admin-panel-heading"><h2>Bookings by Type</h2><span>This Month⌄</span></div><div className="admin-donut"><div>128<small>Bookings</small></div></div><ul className="admin-legend"><li>SUV <b>42%</b></li><li>Tempo Traveller <b>28%</b></li><li>Sedan <b>18%</b></li><li>Luxury <b>8%</b></li></ul></section>
   </div>
   <div className="admin-dashboard-grid admin-dashboard-grid--tables">
     <section className="admin-panel"><div className="admin-panel-heading"><h2>Upcoming Departures</h2><a href="/admin/bookings">View All →</a></div><table className="admin-table"><thead><tr><th>Date</th><th>Package / Route</th><th>Vehicle</th><th>Travellers</th><th>Status</th></tr></thead><tbody>{[["12 Oct","Mahakaleshwar Tour","Innova Crysta","6","Boarding"],["13 Oct","Char Dham Yatra","Tempo Traveller","12","Confirmed"],["15 Oct","Rajasthan Heritage","Toyota Fortuner","4","Confirmed"],["16 Oct","Kashi – Prayagraj","Innova Hycross","5","Preparing"]].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{j===4?<StatusPill tone={c==="Boarding"?"green":c==="Preparing"?"orange":"blue"}>{c}</StatusPill>:c}</td>)}</tr>)}</tbody></table></section>
     <section className="admin-panel"><div className="admin-panel-heading"><h2>Recent Bookings</h2><a href="/admin/bookings">View All →</a></div><table className="admin-table"><thead><tr><th>ID</th><th>Customer</th><th>Route</th><th>Amount</th><th>Status</th></tr></thead><tbody>{[["YT1234","Rahul Mehta","Ujjain Tour","₹14,000","Confirmed"],["YT1233","Priya Sharma","Jaipur Heritage","₹26,000","Pending"],["YT1232","Amit Verma","Varanasi","₹18,500","Confirmed"],["YT1231","Neha Kapoor","Rameshwaram","₹32,000","On Hold"]].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{j===4?<StatusPill tone={c==="Confirmed"?"green":c==="Pending"?"orange":"red"}>{c}</StatusPill>:c}</td>)}</tr>)}</tbody></table></section>
   </div>
 </AdminShell>;
}
