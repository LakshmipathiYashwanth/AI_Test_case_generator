---
# 🔍 AI Test Case Generator – Google Sheets + Gemini API
---

🚀 **Tired of writing test cases from scratch? Let AI do the heavy lifting!**  
This is a smart, AI-assisted **Google Sheets-based tool** that auto-generates test cases using **standard test design techniques** — powered by **Google Apps Script + Gemini API**.

---

## ✨ Features

- ✅ Supports **multiple test scenarios**
- ✅ Simple and clean **UI-based input form** (triggered via macros)
- ✅ Generates test cases using **test design principles** (e.g., boundary value analysis, equivalence partitioning)
- ✅ Seamless **Gemini AI integration** to accelerate test documentation
- ✅ Easy to deploy and reuse across teams

---

## ⚙️ Setup Instructions

### 1. Create a New Google Sheet
Open a blank Google Sheet to get started.

### 2. Open Google Apps Script
Navigate to:  
**Extensions > Apps Script**

### 3. Add the Code
- Copy the contents of `Code.gs` (from this repo) and paste it into the default script file.
- Add a new file named `index.html` and paste the HTML code from the repository.

### 4. Add Your Gemini API Key
- Go to **Project Settings** > **Script Properties**
- Click on **Add Script Property**
  - Property Name: `API_KEY`
  - Value: *(Your Gemini API Key)*

### 5. Deploy as Web App
- Click **Deploy** > **New deployments** > **Select type: Web App**
- Deploy the script. *(Authorization may be required)*

### 6. Use the Tool
- Refresh your Google Sheet.
- A new menu item called **Test Generator** will appear in the toolbar.
- Click **Test Generator > Enter test scenarios**
- Enter one or more test scenarios in the popup form 🖊️
- Click **Generate Test Cases**
- Review and copy the generated test cases to another sheet 📄

---

## 🧪 Who Is This For?

- QA Engineers
- Manual Testers
- Test Leads & Test Designers
- Anyone who wants to save time and enhance quality with AI

---

## 📬 Feedback & Contributions

Found a bug? Want to improve or suggest a feature?  
Feel free to submit a issues/requets. Contributions are welcome! 🙌

---

### 🔗 Built with:
- 💡 Google Apps Script
- 🤖 Gemini API
- ❤️ Passion for simplifying testing

---
