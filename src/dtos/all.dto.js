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

// supplier dtos
exports.supplierDTO = (doc) => {
  if (!doc) return null;

  return {
    id: doc._id?.toString(),
    supplierId: doc.supplierId,
    supplierName: doc.supplierName,
    contactPersonName: doc.contactPersonName || "",
    contactPersonDesignation: doc.contactPersonDesignation || "",
    mobile: doc.mobile || "",
    supplierAddress: doc.supplierAddress || "",
    openingDues: doc.openingDues ?? 0,
    isActive: doc.isActive,
    deletedAt: doc.deletedAt,
  };
};

exports.supplierListDTO = (docs = []) => {
  return docs.map((doc) => ({
    id: doc._id?.toString(),
    supplierId: doc.supplierId,
    supplierName: doc.supplierName,
    contactPersonName: doc.contactPersonName || "",
    contactPersonDesignation: doc.contactPersonDesignation || "",
    mobile: doc.mobile || "",
    supplierAddress: doc.supplierAddress || "",
    openingDues: doc.openingDues ?? 0,
    isActive: doc.isActive,
    deletedAt: doc.deletedAt,
  }));
};

// supplier dto
exports.supplierDuePaymentDTO = (doc) => {
  if (!doc) return null;

  return {
    id: doc._id?.toString(),
    transactionId: doc.transactionId,
    date: doc.date,
    supplierId: doc.supplierId,
    paidAmount: doc.paidAmount,
    lessAmount: doc.lessAmount,
    paymentMode: doc.paymentMode,
    remarks: doc.remarks || "",
    remainingDue: doc.remainingDue,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    deletedAt: doc.deletedAt,
  };
};
// customer.dto.js

exports.customerListDTO = (docs = []) => {
  return docs.map((doc) => ({
    id: doc._id?.toString(),
    customerId: doc.customerId,
    customerType: doc.customerType || "",
    fullName: doc.fullName,
    mobileNumber: doc.mobileNumber,
    occupation: doc.occupation || "",
    nidNumber: doc.nidNumber || "",
    openingDues: doc.openingDues ?? 0,
    regularDiscountPercent: doc.regularDiscountPercent ?? 0,
    emailAddress: doc.emailAddress || "",
    image: doc.image || null,
    presentAddress: doc.presentAddress || "",
    permanentAddress: doc.permanentAddress || "",
    isActive: doc.isActive,
    deletedAt: doc.deletedAt,
    createdAt: doc.createdAt,
  }));
};

exports.customerDetailsDTO = (doc) => {
  if (!doc) return null;

  return {
    id: doc._id?.toString(),
    customerId: doc.customerId,
    customerType: doc.customerType || "",
    fullName: doc.fullName,
    mobileNumber: doc.mobileNumber,
    occupation: doc.occupation || "",
    nidNumber: doc.nidNumber || "",
    openingDues: doc.openingDues ?? 0,
    regularDiscountPercent: doc.regularDiscountPercent ?? 0,
    emailAddress: doc.emailAddress || "",
    image: doc.image || null,
    remarks: doc.remarks || "",
    presentAddress: doc.presentAddress || "",
    permanentAddress: doc.permanentAddress || "",
    isActive: doc.isActive,
    deletedAt: doc.deletedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// customerPayment.dto.js
exports.customerPaymentListDTO = (docs = []) => {
  return docs.map((doc) => ({
    customerName: doc.customerName,
    slug: doc.slug,
    referenceInvoice: doc.referenceInvoice || "",
    dueBalance: doc.dueBalance ?? 0,
    paidAmount: doc.paidAmount ?? 0,
    lessAmount: doc.lessAmount ?? 0,
    cashBack: doc.cashBack ?? 0,
    date: doc.date,
    paymentMode: doc.paymentMode || "",
    remarks: doc.remarks || "",
    deletedAt: doc.deletedAt,
    createdAt: doc.createdAt,
  }));
};

exports.customerPaymentDetailsDTO = (doc) => {
  if (!doc) return null;

  return {
    customerName: doc.customerName,
    slug: doc.slug,
    referenceInvoice: doc.referenceInvoice || "",
    dueBalance: doc.dueBalance ?? 0,
    paidAmount: doc.paidAmount ?? 0,
    lessAmount: doc.lessAmount ?? 0,
    cashBack: doc.cashBack ?? 0,
    date: doc.date,
    paymentMode: doc.paymentMode || "",
    remarks: doc.remarks || "",
    deletedAt: doc.deletedAt,
    createdAt: doc.createdAt,
  };
};
