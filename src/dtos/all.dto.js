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

// employee designation dto
exports.employeeDesignationDTO = (doc) => {
  if (!doc) return null;
  return {
    name: doc.name,
    slug: doc.slug,
  };
};
exports.employeeDepartmentDTO = (doc) => {
  if (!doc) return null;
  return {
    name: doc.name,
    slug: doc.slug,
  };
};
