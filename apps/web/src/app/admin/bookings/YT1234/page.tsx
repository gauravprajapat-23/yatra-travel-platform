import { AdminShell, StatusPill } from "@/components/admin-shell";

export default function BookingDetailPage(){
  return <AdminShell active="Bookings" title="Booking #YT1234" subtitle="Booked on 10 Oct 2024, 04:32 PM" actions={<><button className="admin-secondary-button">Print</button><button className="admin-secondary-button">Send Invoice</button><button className="admin-primary-button">Edit Booking</button></>}>
    <div className="admin-detail-grid">
      <section className="admin-panel admin-detail-card"><div className="admin-panel-heading"><h2>Trip Overview</h2><a>Edit</a></div><div className="admin-detail-image"/><h3>Ujjain Mahakaleshwar Tour</h3><p>3 Days / 2 Nights</p><ul><li>Indore → Ujjain → Omkareshwar</li><li>12 Oct 2024 – 14 Oct 2024</li><li>6 Travellers</li><li>Temple Tour · Spiritual</li></ul><div className="admin-amount-card"><span>Total Amount</span><strong>₹14,000</strong><a>View Invoice →</a></div></section>
      <section className="admin-detail-column">
        <article className="admin-panel admin-detail-card"><div className="admin-panel-heading"><h2>Customer Details</h2><a>Edit</a></div><div className="admin-person"><span>RM</span><div><strong>Rahul Mehta</strong><small>+91 98765 43210</small><small>rahul.mehta@gmail.com</small></div></div><dl><div><dt>Total Travellers</dt><dd>6 Adults</dd></div><div><dt>Booking Type</dt><dd>Cab with Driver</dd></div><div><dt>Special Requests</dt><dd>Early morning darshan</dd></div></dl></article>
        <article className="admin-panel admin-detail-card"><div className="admin-panel-heading"><h2>Payment Information</h2><StatusPill>Paid</StatusPill></div><dl><div><dt>Total Amount</dt><dd>₹14,000</dd></div><div><dt>Advance Paid</dt><dd>₹7,000</dd></div><div><dt>Remaining Amount</dt><dd>₹0</dd></div><div><dt>Payment Method</dt><dd>UPI (GPay)</dd></div></dl></article>
      </section>
      <section className="admin-detail-column">
        <article className="admin-panel admin-detail-card"><div className="admin-panel-heading"><h2>Vehicle & Driver</h2><a>Edit</a></div><div className="admin-vehicle-visual"><div className="vehicle-list-card__car"/></div><strong>Innova Crysta</strong><small>Premium SUV · 6 Seats</small><div className="admin-person"><span>SY</span><div><strong>Suresh Yadav</strong><small>★ 4.8 · 2,130+ Trips</small></div></div></article>
        <article className="admin-panel admin-detail-card"><h2>Booking Timeline</h2><div className="admin-timeline">{["Booking Created","Advance Payment Received","Booking Confirmed","Driver Assigned","Trip Started"].map((x,i)=><div key={x}><span>{i<3?"✓":"○"}</span><div><strong>{x}</strong><small>{10+i} Oct 2024</small></div></div>)}</div></article>
      </section>
    </div>
    <div className="admin-detail-bottom"><section className="admin-panel admin-notes"><div className="admin-panel-heading"><h2>Notes</h2><a>＋ Add Note</a></div><p>Driver details shared with customer.</p><p>Customer requested early morning darshan.</p></section><aside className="admin-panel admin-quick-actions"><h2>Quick Actions</h2><button>Resend Confirmation</button><button>Modify Booking</button><button className="admin-danger-button">Cancel Booking</button></aside></div>
  </AdminShell>;
}
