const Permission = require("../models/permisson.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const permission = [
  { permissionName: "Product", actions: ["view"] },
  { permissionName: "Category", actions: ["view"] },
  { permissionName: "Order", actions: ["view"] },
  { permissionName: "Discount", actions: ["view"] },
  { permissionName: "Variant", actions: ["view"] },
  { permissionName: "SubCategory", actions: ["view"] },
  { permissionName: "Brand", actions: ["view"] },
  { permissionName: "productInventory", actions: ["view"] },
  { permissionName: "RawProduct", actions: ["view"] },
  { permissionName: "ProductionStuff", actions: ["view"] },
  { permissionName: "Purchase", actions: ["view"] },
  { permissionName: "Sales", actions: ["view"] },
  { permissionName: "Stock", actions: ["view"] },
  { permissionName: "user", actions: ["view"] },
  { permissionName: "Supplier", actions: ["view"] },
  { permissionName: "Employee", actions: ["view"] },
  { permissionName: "Attendance", actions: ["view"] },
  { permissionName: "Sms", actions: ["view"] },
  { permissionName: "UserRoleAndPermission", actions: ["view"] },
  { permissionName: "Settings", actions: ["view"] },
  { permissionName: "Notification", actions: ["view"] },
  { permissionName: "Report", actions: ["view"] },
];

async function seedPermisson() {
  try {
    await Permission.deleteMany({});
    console.log("All permissions deleted.");

    // Check if permissions already exist
    // const existingPermissions = await Permission.find();
    // if (existingPermissions.length > 0) {
    //   console.log("Permissions already seeded.");
    //   return;
    // }

    // Insert permissions
    // await Permission.insertMany(permission);
    // console.log("Permissions seeded successfully.");
    //now delete all permissions

    // If you want to drop the index, uncomment the following line
    // await mongoose.connection
    //   .collection("permissions")
    //   .dropIndex("PermissionName_1");
    const existingPermissions = await Permission.find({});
    if (existingPermissions?.length > 0) {
      console.log("Permissions already seeded.");
      // await Permission.deleteMany({});
      // console.log("All permissions deleted.");
      return;
    }
    for (const perm of permission) {
      const existingPermission = await Permission.findOne({
        permissionName: perm.permissionName,
      });
      if (!existingPermission) {
        const newPermission = new Permission(perm);
        await newPermission.save();
        console.log(`Permission ${perm.permissionName} seeded successfully.`);
      } else {
        console.log(`Permission ${perm.permissionName} already exists.`);
      }
    }
  } catch (error) {
    console.error("Error seeding permissions:", error);
  }
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    return seedPermisson();
  })
  .then(() => {
    return mongoose.disconnect();
  })
  .catch((err) => {
    console.error(
      "Error connecting to MongoDB While permissions seeding:",
      err
    );
    process.exit(1);
  });

/**
   * const User = require("../models/User");
const UserPermission = require("../models/UserPermission");

const authorize = (permissionName, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Single query to get user with populated roles and permissions
      const userWithRoles = await User.findById(user._id)
        .populate({
          path: 'roles',
          populate: {
            path: 'permissions'
          }
        })
        .lean(); // Use lean() for better performance

      // Check role-based permissions
      if (userWithRoles.roles && userWithRoles.roles.length > 0) {
        for (const role of userWithRoles.roles) {
          if (role.permissions) {
            for (const perm of role.permissions) {
              if (perm.PermissionName === permissionName && 
                  perm.actions && perm.actions.includes(action)) {
                return next(); // Authorized through role
              }
            }
          }
        }
      }

      // Check individual user permissions
      const userPerm = await UserPermission.findOne({ user: user._id })
        .populate("permissions")
        .lean();
      
      if (userPerm && userPerm.permissions) {
        for (const perm of userPerm.permissions) {
          if (perm.PermissionName === permissionName && 
              perm.actions && perm.actions.includes(action)) {
            return next(); // Authorized through individual permission
          }
        }
      }

      // Not authorized
      return res.status(403).json({ 
        message: "Forbidden: Access denied",
        required: { permission: permissionName, action: action }
      });

    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
};

module.exports = authorize;
   */

/**
 * // Routes
router.get('/users', authorize('users', 'read'), getUsersController);
router.post('/users', authorize('users', 'create'), createUserController);
router.put('/users/:id', authorize('users', 'update'), updateUserController);
router.delete('/users/:id', authorize('users', 'delete'), deleteUserController);
 */
