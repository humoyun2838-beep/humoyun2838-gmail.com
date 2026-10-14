FROM python:3.12-slim
WORKDIR /app
COPY railway_gateway.py /app/
CMD ["python", "-u", "railway_gateway.py"]
