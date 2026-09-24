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
  password: "Kipkoech06",
  database: "greatriftshuttle",
});
const PORT = 3003;
dbConn.query(
  "ALTER TABLE drivers ADD COLUMN password_hash VARCHAR(255) NULL",
  (err) => {
    if (err && err.code !== "ER_DUP_FIELDNAME") {
      console.error("Driver authentication schema error:", err);
    }
  },
);
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
  res.render("login.ejs", { loginError: req.query.error || null });
});
app.post("/login", (req, res) => {
  // recievedlogin data - username,password,remember me
  const { username, password, role, id_number, license_number } = req.body;
  if (role === "driver") {
    return dbConn.query(
      "SELECT driver_id, first_name, last_name, password_hash, status FROM drivers WHERE id_number = ? AND license_number = ?",
      [String(id_number || "").trim(), String(license_number || "").trim()],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).send("Internal Server Error");
        }
        if (results.length === 0 || results[0].status !== "active") {
          return res.redirect("/login?error=Invalid driver ID or license number.");
        }
        const driver = results[0];
        if (!driver.password_hash) {
          req.session.passwordSetupDriverId = driver.driver_id;
          return res.redirect("/driver/set-password");
        }
        if (!password || !bcrypt.compareSync(password, driver.password_hash)) {
          return res.redirect("/login?error=Invalid driver password.");
        }
        req.session.user = {
          id: driver.driver_id,
          username: `${driver.first_name} ${driver.last_name}`,
          role: "driver",
        };
        return res.redirect("/dashboard");
      },
    );
  }
  dbConn.query(
    "SELECT * FROM admin_users WHERE username = ?",
    [username],
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
        req.session.user = {
          id: user.admin_id,
          username: user.username,
          role: "admin",
        }; // store user info in session- signing user info in a session cookie to maintain authentication state across requests
        res.redirect("/dashboard"); // redirect to dashboard on successful login
      } else {
        res.status(401).redirect("/login"); // redirect back to login on failed login attempt
      }
    },
  );
});

app.get("/driver/set-password", (req, res) => {
  if (!req.session.passwordSetupDriverId) {
    return res.redirect("/login");
  }
  res.render("driver-set-password.ejs", {
    passwordError: req.query.error || null,
  });
});

app.post("/driver/set-password", (req, res) => {
  const driverId = req.session.passwordSetupDriverId;
  const { password, confirm_password } = req.body;
  if (!driverId) {
    return res.status(401).redirect("/login");
  }
  if (
    !password ||
    password.length < 8 ||
    password !== confirm_password ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return res.redirect(
      "/driver/set-password?error=Password must be 8+ characters with uppercase, lowercase, and a number.",
    );
  }
  dbConn.query(
    "UPDATE drivers SET password_hash = ? WHERE driver_id = ? AND password_hash IS NULL",
    [bcrypt.hashSync(password, 10), driverId],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send("Internal Server Error");
      }
      if (result.affectedRows !== 1) {
        return res.redirect("/login?error=Password setup has already been completed.");
      }
      req.session.destroy(() =>
        res.redirect("/login?error=Password created. Please log in."),
      );
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
  if (req.session && req.session.user && req.session.user.role === "admin") {
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
    const tripsQuery = `
      SELECT
        t.trip_id,
        t.departure_time,
        r.origin,
        r.destination,
        v.capacity,
        COUNT(b.booking_id) AS booked_seats
      FROM trips t
      JOIN routes r ON r.route_id = t.route_id
      JOIN vehicles v ON v.number_plate = t.number_plate
      LEFT JOIN bookings b ON b.trip_id = t.trip_id
      WHERE t.status = 'scheduled' AND t.departure_time > NOW()
      GROUP BY t.trip_id, t.departure_time, r.origin, r.destination, v.capacity
      ORDER BY t.departure_time
    `;
    const bookingsQuery = `
      SELECT
        b.booking_id,
        b.client_name,
        b.client_phone,
        b.client_email,
        b.seat_number,
        b.booking_date,
        b.payment_status,
        t.departure_time,
        r.origin,
        r.destination
      FROM bookings b
      JOIN trips t ON t.trip_id = b.trip_id
      JOIN routes r ON r.route_id = t.route_id
      ORDER BY b.booking_date DESC
    `;

    dbConn.query(tripsQuery, (tripsErr, trips) => {
      if (tripsErr) {
        console.error("Database error:", tripsErr);
        return res.status(500).send("Internal Server Error");
      }
      dbConn.query(bookingsQuery, (bookingsErr, bookings) => {
        if (bookingsErr) {
          console.error("Database error:", bookingsErr);
          return res.status(500).send("Internal Server Error");
        }
        res.render("bookings-manage.ejs", {
          trips,
          bookings,
          bookingError: req.query.error || null,
          bookingSuccess: req.query.success === "true",
        });
      });
    });
  } else {
    res.status(401).redirect("/login");
  }
});

app.post("/add-booking", (req, res) => {
  if (!(req.session && req.session.user)) {
    return res.status(401).redirect("/login");
  }

  const { trip_id, client_name, client_phone, client_email, seat_number } =
    req.body;
  const tripId = Number.parseInt(trip_id, 10);
  const seatNumber = Number.parseInt(seat_number, 10);

  if (
    !Number.isInteger(tripId) ||
    !client_name ||
    !client_phone ||
    !Number.isInteger(seatNumber) ||
    seatNumber < 1
  ) {
    return res.redirect("/bookings?error=Enter all required booking details.");
  }

  const tripQuery = `
    SELECT t.trip_id, v.capacity
    FROM trips t
    JOIN vehicles v ON v.number_plate = t.number_plate
    WHERE t.trip_id = ? AND t.status = 'scheduled' AND t.departure_time > NOW()
  `;

  dbConn.query(tripQuery, [tripId], (tripErr, tripResults) => {
    if (tripErr) {
      console.error("Database error:", tripErr);
      return res.status(500).send("Internal Server Error");
    }
    if (tripResults.length === 0 || seatNumber > tripResults[0].capacity) {
      return res.redirect("/bookings?error=That trip is unavailable or the seat number is invalid.");
    }

    const seatQuery =
      "SELECT booking_id FROM bookings WHERE trip_id = ? AND seat_number = ?";
    dbConn.query(seatQuery, [tripId, seatNumber], (seatErr, seatResults) => {
      if (seatErr) {
        console.error("Database error:", seatErr);
        return res.status(500).send("Internal Server Error");
      }
      if (seatResults.length > 0) {
        return res.redirect("/bookings?error=That seat is already booked for this trip.");
      }

      const insertQuery = `
        INSERT INTO bookings
          (trip_id, client_name, client_phone, client_email, seat_number)
        VALUES (?, ?, ?, ?, ?)
      `;
      dbConn.query(
        insertQuery,
        [tripId, client_name.trim(), client_phone.trim(), client_email || null, seatNumber],
        (insertErr) => {
          if (insertErr) {
            console.error("Database error:", insertErr);
            return res.status(500).send("Internal Server Error");
          }
          res.redirect("/bookings?success=true");
        },
      );
    });
  });
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
  if (req.session && req.session.user && req.session.user.role === "admin") {
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
    const departureDate = new Date(departure_time);

    if (
      !departure_time ||
      Number.isNaN(departureDate.getTime()) ||
      departureDate <= new Date()
    ) {
      return res
        .status(400)
        .send("Departure date and time must be a valid future date and time.");
    }

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
app.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));