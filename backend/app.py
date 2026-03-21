from fastapi import FastAPI

app = FastAPI()
app.version = "0.1.0"
app.contact = {
    "name": "Vigop",
    "email": "vigop@example.com"
}
app.license_info = {
    "name": "MIT License",
    "url": "https://opensource.org/licenses/MIT"
}
app.description = "This is a sample FastAPI application with metadata."
app.title = "Sample FastAPI Application"

@app.get("/")
async def read_root():
    return {"message": "Hello, World!"}