export const bookingFilters = [
 {id:'ALL',label:'All'}, {id:'PENDING',label:'Pending'},
 {id:'APPROVED',label:'Confirmed'}, {id:'IN_PROGRESS',label:'Ongoing'},
 {id:'COMPLETED',label:'Completed'}, {id:'CANCELLED',label:'Cancelled'},
 {id:'REJECTED',label:'Rejected'},
];
export function matchesBookingFilter(booking, filter) {
 return filter === 'ALL' || booking.status === filter;
}
export function hasFinalBill(booking) {
 return booking.status === 'COMPLETED' && booking.final_total !== null && booking.final_total !== undefined;
}
export const rentalStages = [
 {id:'PENDING',label:'Requested'}, {id:'APPROVED',label:'Confirmed'},
 {id:'IN_PROGRESS',label:'Ongoing'}, {id:'COMPLETED',label:'Completed'},
];
