import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
const rows=[
 ["Rahul Mehta","+91 98765 43210","DL1420167890","8 yrs","★ 4.8",<StatusPill key="1">Available</StatusPill>,<StatusPill key="2">Valid</StatusPill>,"•••"],
 ["Suresh Yadav","+91 98765 67890","UP3220154321","6 yrs","★ 4.6",<StatusPill key="3" tone="orange">On Trip</StatusPill>,<StatusPill key="4">Valid</StatusPill>,"•••"],
 ["Amit Verma","+91 98290 12345","RJ1420176543","10 yrs","★ 4.9",<StatusPill key="5">Available</StatusPill>,<StatusPill key="6">Valid</StatusPill>,"•••"],
 ["Ramesh Kumar","+91 94132 56789","RJ2720149876","12 yrs","★ 4.7",<StatusPill key="7" tone="orange">On Trip</StatusPill>,<StatusPill key="8">Valid</StatusPill>,"•••"],
 ["Vikram Singh","+91 98710 34567","HR2620161234","7 yrs","★ 4.5",<StatusPill key="9" tone="red">Maintenance</StatusPill>,<StatusPill key="10" tone="orange">Expiring</StatusPill>,"•••"],
];
export default function AdminDriversPage(){return <AdminTablePage active="Drivers & Staff" title="Drivers" subtitle="View, manage and assign drivers to trips. Track documents, ratings and availability." buttonLabel="Add Driver" metrics={[{label:"Total Drivers",value:"28",meta:"↑ 7%",tone:"blue"},{label:"Active Drivers",value:"24",meta:"85.7% available",tone:"green"},{label:"On Trip",value:"12",meta:"42.9% assigned",tone:"orange"},{label:"Documents Due",value:"3",meta:"expiring soon",tone:"red"}]} filters={["All Drivers","Available","On Trip","Maintenance"]} columns={["Driver","Contact","License No.","Experience","Rating","Status","Documents","Actions"]} rows={rows}/>;}
