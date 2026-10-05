import { AdminShell, StatusPill } from "@/components/admin-shell";

export default function PackageEditorPage(){
 return <AdminShell active="Tours & Packages" title="Edit Package" subtitle="Update package details, itinerary, pricing and publish." actions={<><button className="admin-secondary-button">Preview</button><button className="admin-secondary-button">Save Draft</button><button className="admin-primary-button">Publish Package</button></>}>
   <div className="admin-editor-layout">
     <aside className="admin-editor-nav">{["Basic Information","Itinerary","Inclusions & Exclusions","Pricing & Variants","Media Gallery","SEO & Tags","Settings"].map((x,i)=><button className={i===0?"is-active":""} key={x}>{x}</button>)}</aside>
     <section className="admin-panel admin-editor-form">
       <div className="admin-editor-title"><div><h2>Edit Package <StatusPill>Active</StatusPill></h2><p>Update package details, itinerary, pricing and publish.</p></div><small>Last updated<br/>12 Oct 2024, 10:24 AM</small></div>
       <h3>Basic Information</h3>
       <div className="admin-form-two"><label>Package Title<input defaultValue="Ujjain Mahakaleshwar Tour"/></label><div className="admin-image-uploader"><div className="admin-image-uploader__preview"/><button>Change Image</button></div><label>Slug (URL)<input defaultValue="ujjain-mahakaleshwar-tour"/></label><label className="admin-form-wide">Short Description<textarea defaultValue="Experience the divine journey to Lord Mahakaleshwar in Ujjain, with visits to Omkareshwar, Indore and other sacred sites."/></label><label>Category<select><option>Spiritual</option></select></label><label>Duration<select><option>3 Days / 2 Nights</option></select></label><label>Group Type<select><option>Group Tour</option></select></label><label className="admin-form-wide">Destinations<input defaultValue="Ujjain, Omkareshwar, Indore"/></label></div>
       <div className="admin-editor-bottom-grid"><div><h3>Highlights</h3>{["Darshan at Mahakaleshwar Temple","Omkareshwar Jyotirlinga Visit","Comfortable AC Transport","Experienced Tour Guide","Hotel Stay with Breakfast"].map((x,i)=><label className="admin-check-row" key={x}><input type="checkbox" defaultChecked={i!==3}/>{x}</label>)}</div><aside className="admin-quick-info"><h3>Quick Info</h3><span><strong>Starting Price</strong>₹14,000 per person</span><span><strong>Duration</strong>3 Days / 2 Nights</span><span><strong>Group Size</strong>2–25 People</span><span><strong>Difficulty</strong>Easy</span></aside></div>
     </section>
   </div>
 </AdminShell>;
}
