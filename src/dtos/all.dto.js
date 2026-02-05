exports.employeeAdvancePaymentDTO = (doc) => {
  if (!doc) return null;

  return {
    id: doc._id.toString(),
    date: doc.date?.toISOString().split("T")[0], // YYYY-MM-DD
    month: doc.month,
    employeeId: doc.employeeId,
    amount: doc.amount,
    balanceAmount: doc.balanceAmount,
    paymentMode: doc.paymentMode,
    remarks: doc.remarks ?? "",
  };
};
