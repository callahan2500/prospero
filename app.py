from flask import Flask, render_template, request, jsonify
import openai
import os

app = Flask(__name__)

openai.api_key = os.environ.get("OPENAI_KEY")

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/project")
def project():
    return render_template("project.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    question = data.get('question', '')
    projectBrief = 'We are a leading company specializing in creating chatbots for virtual educational organizations, including bootcamps, online universities, and homeschooling platforms. Our mission is to enhance the educational experience through intuitive and AI-powered chatbot solutions.'#data.get('projectBrief', '')
    objective = 'Design a customizable chatbot that aligns with each clients branding. This chatbot should cater to educational programs serving people of all ages. The primary goal is to facilitate efficient communication between teachers and students, with features that aid in teaching and learning.'#data.get('objective', '')
    previous_interactions = data.get('previous_interactions', [])  # A list to hold previous Q&A pairs.
    
    context = f"Company Overview: {projectBrief}\nObjective: {objective}"
    interactions = "\n".join(previous_interactions)
    
    prompt = f"{context}\n{interactions}\n\nUser: {question}\nAI: Based on the context provided, " \
             "please do not simply restate the problem. Instead, provide a specific, clear, " \
             "and actionable response or suggest the next steps that can be taken to solve the problem. " \
             "If the context is not sufficient to answer, please ask clarifying questions to get more information."
    
    #prompt = f"{context}\n\nUser: {question}\nAI:"
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages =[
                {
                "role": "user",
                "content": prompt
                },

            ],
            temperature=1,
            max_tokens=700,
        )
        print("OpenAI Response: ", response.choices)  # Add this line

        
        answer = response.choices[0].message['content'].strip()
        new_interaction = f"User: {question}\nAI: {answer}"
        previous_interactions.append(new_interaction)
        print(answer)
        return jsonify({"answer": answer, "previous_interactions": previous_interactions})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/homepage')
def homepage():
    return render_template('homepage.html')

@app.route('/result')
def result():
    return render_template('result.html')

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

