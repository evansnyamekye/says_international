// API Submission Handler / Logic for Admission Formasync function submitForm() 
{
  const fullName = document.getElementById("student_name").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!fullName || !email) {
    document.getElementById("submitMessage").innerText =
      "❌ Please enter Student Full Name and Email.";
    //return;
  }

  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";

  const payload = { firstName, middleName, lastName, email };

  const msg = document.getElementById("submitMessage");
  msg.innerText = "⏳ Submitting application...";

  try {
    const res = await fetch("/api/admission-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    const saved = await res.json();
    console.log("Saved student:", saved);

    msg.innerText = "✅ Application submitted successfully!";
    document.getElementById("admissionForm").reset();

  } catch (err) {
    console.error(err);
    msg.innerText = "❌ Submission failed. Check console and backend logs.";
  }
}
