const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");
const app = express();
const mysql = require("mysql2");
const { formatDate } = require("./utility");
const dbConn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "54321",
  database: "greatriftshuttle",
});
app.use(
  session({
    secret: "qwertyuiopasdfghjklzxcvbnm", // should be a long, random string in production and stored securely
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }, // set to true if using HTTPS, adjust maxAge as needed- ms
  }),
);
app.use(express.static("public")); // direct server to redirect any statci files(js,css,images) requests to the public folder
app.use(express.urlencoded({ extended: true })); // middleware to parse form data
// public routes - accessible to all users
app.use((req, res, next) => {
  res.locals.user = req.session.user || null; // make user info available in all views for conditional rendering
  next();
});
app.get("/", (req, res) => {
  res.render("index.ejs");
});
app.get("/about", (req, res) => {
  res.render("about.ejs");
});
app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});
app.get("/login", (req, res) => {
  res.render("login.ejs");
});
app.post("/login", (req, res) => {
  // recievedlogin data - username,password,remember me
  const { username, password, remember } = req.body;
  dbConn.query(
    `SELECT * FROM admin_users WHERE username = "${username}"`,
    (err, results) => {
      // check for mysql connection of sql statements errors
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      // if there are no errors - then check if the username exists in the database - data matching the username provided in the login form
      console.log(results);
      if (results.length === 0) {
        return res.status(401).redirect("/login"); // redirect back to login on failed login attempt
      }
      // if the username exists - then check if the password provided in the login form matches the password hash stored in the database for that user
      console.log("User found:", results[0]);
      const user = results[0];
      if (bcrypt.compareSync(password, user.password_hash)) {
        // use hashed passwords and a secure comparison method - bcrypt
        req.session.user = { id: user.id, username: user.username }; // store user info in session- signing user info in a session cookie to maintain authentication state across requests
        res.redirect("/dashboard"); // redirect to dashboard on successful login
      } else {
        res.status(401).redirect("/login"); // redirect back to login on failed login attempt
      }
    },
  );
});

// logout logic - destroy the user session and redirect to login page
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.status(304).redirect("/login");
});
// Private Routes - only accessible to authenticated users
app.get("/dashboard", (req, res) => {
  if (req.session && req.session.user) {
    res.render("dashboard.ejs"); // render user dashboard
  } else {
    res.status(401).redirect("/login"); // restrict access to dashboard for unauthenticated users
  }
});
app.get("/register/admin", (req, res) => {
  if (req.session && req.session.user) {
    res.render("registeradmin.ejs");
  } else {
    res.status(401).send("Not Allowed / Unauthorized ");
  }
});
app.post("/register/admin", (req, res) => {
  if (req.session && req.session.user) {
    const { username, password } = req.body;
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(password, saltRounds);
    const insertQuery = `INSERT INTO admin_users (username, password_hash) VALUES ("${username}", "${hashedPassword}")`;

    dbConn.query(insertQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/register/admin?success=true");
    });
  } else {
    res.status(401).send("Not Allowed / Unauthorized ");
  }
});
app.get("/register/driver", (req, res) => {
  if (req.session && req.session.user) {
    res.render("registerdriver.ejs");
  } else {
    res.status(401).send("Not Allowed / Unauthorized ");
  }
});

app.get("/trips", (req, res) => {
  if (req.session && req.session.user) {
    const getDriverInfo = `select driver_id, first_name, last_name, license_number from drivers`;
    const getRouteInfo = `select route_id, origin, destination from routes`;
    const getVehicleInfo = `select number_plate, model from vehicles`;
    const getAllTrips = `select * from trips`;
    dbConn.query(getDriverInfo, (d_err, driverResults) => {
      if (d_err) {
        console.error("Database error:", d_err);
        return res.status(500).send("Internal Server Error");
      }
      dbConn.query(getRouteInfo, (r_err, routeResults) => {
        if (r_err) {
          console.error("Database error:", r_err);
          return res.status(500).send("Internal Server Error");
        }
        dbConn.query(getVehicleInfo, (v_err, vehicleResults) => {
          if (v_err) {
            console.error("Database error:", v_err);
            return res.status(500).send("Internal Server Error");
          }
          dbConn.query(getAllTrips, (t_err, tripResults) => {
            if (t_err) {
              console.error("Database error:", t_err);
              return res.status(500).send("Internal Server Error");
            }
            res.render("manage-trips.ejs", {
              drivers: driverResults,
              routes: routeResults,
              vehicles: vehicleResults,
              trips: tripResults,
            });
          });
        });
      });
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/bookings", (req, res) => {
  if (req.session && req.session.user) {
    res.render("bookings-manage.ejs");
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/routes", (req, res) => {
  if (req.session && req.session.user) {
    dbConn.query("SELECT * FROM routes", (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.render("routes-browse.ejs", {
        routes: results,
        addSuccess: req.query.addSuccess === "true",
      });
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.post("/add-route", (req, res) => {
  if (req.session && req.session.user) {
    const { origin, destination, base_price, distance_km, estimated_duration } =
      req.body;
    const insertQuery = ` INSERT INTO routes (origin, destination, base_price, distance_km, estimated_duration) VALUES ("${origin}", "${destination}", ${base_price}, ${distance_km}, ${estimated_duration})`;

    dbConn.query(insertQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/routes?addSuccess=true"); // redirect to routes page with success message on successful route addition
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/drivers", (req, res) => {
  if (req.session && req.session.user) {
    dbConn.query("SELECT * FROM drivers", (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.render("manage-drivers.ejs", {
        drivers: results,
        addSuccess: req.query.addSuccess === "true",
        formatDate: formatDate,
      });
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.post("/add-driver", (req, res) => {
  if (req.session && req.session.user) {
    const {
      first_name,
      last_name,
      id_number,
      phone_number,
      license_number,
      license_expiry_date,
    } = req.body;
    const insertQuery = `INSERT INTO drivers (first_name, last_name, id_number, phone_number, license_number, license_expiry_date) VALUES ("${first_name}", "${last_name}", "${id_number}", "${phone_number}", "${license_number}", "${license_expiry_date}")`;

    dbConn.query(insertQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/drivers?addSuccess=true");
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/vehicles", (req, res) => {
  if (req.session && req.session.user) {
    dbConn.query("SELECT * FROM vehicles", (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.render("manage-vehicles.ejs", {
        vehicles: results,
        addSuccess: req.query.addSuccess === "true",
      });
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.post("/add-vehicle", (req, res) => {
  if (req.session && req.session.user) {
    const { number_plate, model, color, capacity, status } = req.body;
    const insertQuery = `INSERT INTO vehicles (number_plate, model, color, capacity, status) VALUES ("${number_plate}", "${model}", "${color}", ${capacity}, "${status}")`;

    dbConn.query(insertQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/vehicles?addSuccess=true");
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/update-driver-status", (req, res) => {
  if (req.session && req.session.user) {
    const { driverId, status } = req.query;
    const updateQuery = `UPDATE drivers SET status = "${status}" WHERE driver_id = ${driverId}`;

    dbConn.query(updateQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/drivers");
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/update-vehicle-status", (req, res) => {
  if (req.session && req.session.user) {
    const { numberPlate, status } = req.query;
    const updateQuery = `UPDATE vehicles SET status = "${status}" WHERE number_plate = "${numberPlate}"`;

    dbConn.query(updateQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/vehicles");
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.post("/add-trip", (req, res) => {
  if (req.session && req.session.user) {
    const { driver_id, route_id, number_plate, departure_time, status } =
      req.body;
    const insertQuery = `INSERT INTO trips (driver_id, route_id, number_plate, departure_time, status) VALUES (${driver_id}, ${route_id}, "${number_plate}", "${departure_time}", "${status}")`;

    dbConn.query(insertQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/trips");
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/update-trip-status", (req, res) => {
  if (req.session && req.session.user) {
    const { tripId, status } = req.query;
    const updateQuery = `UPDATE trips SET status = "${status}" WHERE trip_id = ${tripId}`;

    dbConn.query(updateQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/trips");
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/delete-trip", (req, res) => {
  if (req.session && req.session.user) {
    const { tripId } = req.query;
    const deleteQuery = `DELETE FROM trips WHERE trip_id = ${tripId}`;

    dbConn.query(deleteQuery, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      res.redirect("/trips");
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.get("/payments", (req, res) => {
  if (req.session && req.session.user) {
    res.render("payments-manage.ejs");
  } else {
    res.status(401).redirect("/login");
  }
});

//start the app
app.listen(3003, () => console.log("Server running on PORT 3003"));
