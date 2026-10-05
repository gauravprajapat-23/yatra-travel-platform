import { AdminTablePage, StatusPill } from "@/components/admin-table-page";

const rows=[
 ["YT1234","Rahul Mehta","Ujjain Tour","12 Oct 2024","Innova Crysta","₹14,000",<StatusPill key="s1">Confirmed</StatusPill>,"•••"],
 ["YT1233","Priya Sharma","Jaipur Heritage","13 Oct 2024","Tempo Traveller","₹26,000",<StatusPill key="s2" tone="orange">Pending</StatusPill>,"•••"],
 ["YT1232","Amit Verma","Varanasi – Prayagraj","15 Oct 2024","Fortuner","₹18,500",<StatusPill key="s3">Confirmed</StatusPill>,"•••"],
 ["YT1231","Neha Kapoor","Rameshwaram Tour","16 Oct 2024","Innova Hycross","₹32,000",<StatusPill key="s4" tone="orange">On Hold</StatusPill>,"•••"],
 ["YT1229","Karan Soni","Manali Getaway","20 Oct 2024","Tempo Traveller","₹24,000",<StatusPill key="s5">Confirmed</StatusPill>,"•••"],
 ["YT1228","Sneha Iyer","Kerala Backwaters","22 Oct 2024","Innova Crysta","₹28,000",<StatusPill key="s6">Confirmed</StatusPill>,"•••"],
];
export default function AdminBookingsPage(){return <AdminTablePage active="Bookings" title="Bookings" subtitle="View, search and manage all bookings across tours, cars and fleet." buttonLabel="New Booking" metrics={[{label:"All Bookings",value:"246",meta:"this month",tone:"orange"},{label:"Confirmed",value:"142",meta:"58%",tone:"green"},{label:"Pending",value:"36",meta:"needs action",tone:"orange"},{label:"Completed",value:"32",meta:"this month",tone:"blue"}]} filters={["All (246)","Confirmed (142)","Pending (36)","On Hold (18)","Completed (32)","Cancelled (18)"]} columns={["Booking ID","Customer","Route / Package","Date","Vehicle","Amount","Status","Actions"]} rows={rows}/>;}
