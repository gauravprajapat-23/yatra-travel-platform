import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
const rows=[
 ["HR26AB1234","Innova Crysta","SUV","7","Delhi",<StatusPill key="1">Available</StatusPill>,<StatusPill key="2">Good</StatusPill>,"•••"],
 ["RJ14CD5678","Tempo Traveller","Tempo","12","Jaipur",<StatusPill key="3" tone="orange">On Trip</StatusPill>,<StatusPill key="4">Good</StatusPill>,"•••"],
 ["UP32EF9012","Force Traveller","Tempo","17","Lucknow",<StatusPill key="5">Available</StatusPill>,<StatusPill key="6" tone="red">Service Due</StatusPill>,"•••"],
 ["MH01GH3456","Toyota Fortuner","SUV","7","Mumbai",<StatusPill key="7" tone="orange">On Trip</StatusPill>,<StatusPill key="8">Good</StatusPill>,"•••"],
 ["KA05JK7890","Innova Hycross","SUV","7","Bengaluru",<StatusPill key="9">Available</StatusPill>,<StatusPill key="10">Good</StatusPill>,"•••"],
];
export default function AdminVehiclesPage(){return <AdminTablePage active="Fleet Management" title="Vehicles" subtitle="Manage your fleet, track availability, maintenance and assignments." buttonLabel="Add Vehicle" metrics={[{label:"Total Vehicles",value:"42",meta:"↑ 12%",tone:"blue"},{label:"On Trip",value:"24",meta:"57.1% currently in use",tone:"green"},{label:"Available",value:"14",meta:"33.3% ready",tone:"green"},{label:"In Maintenance",value:"4",meta:"9.5% under service",tone:"orange"}]} filters={["All Vehicles","Available","On Trip","Maintenance"]} columns={["Vehicle No.","Vehicle","Type","Seats","Location","Status","Maintenance","Actions"]} rows={rows}/>;}
