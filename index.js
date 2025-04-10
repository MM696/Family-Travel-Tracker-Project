import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const app = express();
const port = 3000;

// PostgreSQL Connection Setup
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false }, // Enable SSL for Render
});

pool.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.error("Database connection error:", err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

async function checkVisisted() {
  const result = await pool.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map((row) => row.country_code);
}

async function getCurrentUser() {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [currentUserId]);
  return result.rows[0]; // returns undefined if not found
}

async function getAllUsers() {
  const result = await pool.query("SELECT * FROM users;");
  return result.rows;
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisisted();
    const currentUser = await getCurrentUser();
    users = await getAllUsers();

    if (!currentUser) {
      return res.status(404).send("User not found.");
    }

    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error.");
  }
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return res.status(404).send("User not found.");
  }

  try {
    const result = await pool.query(
      "SELECT country_code FROM various_countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    if (!data) {
      return res.status(404).send("Country not found.");
    }

    const countryCode = data.country_code;
    try {
      await pool.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error saving country.");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error querying country.");
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = Number(req.body.user);
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  try {
    const result = await pool.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    const id = result.rows[0].id;
    currentUserId = id;

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to create new user.");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
