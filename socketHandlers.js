import PollManager from "./pollManager.js";

const pollManager = new PollManager();
const teacherSocket = { id: null };
const chatMessages = [];

const sendInitialState = (socket) => {
  socket.emit("poll:current", pollManager.getCurrentPoll());
  socket.emit("students:list", pollManager.getStudentsList());
  socket.emit("poll:history", pollManager.getPollHistory());
  socket.emit("chat:history", chatMessages);
};

export function initializeSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("teacher:join", () => {
      teacherSocket.id = socket.id;
      socket.join("teacher");
      sendInitialState(socket);
    });

    socket.on("poll:create", (data) => {
      try {
        const poll = pollManager.createPoll(data);

        io.emit("poll:new", {
          id: poll.id,
          question: poll.question,
          options: poll.options.map((o) => o.text),
          timeLimit: poll.timeLimit,
          startTime: poll.startTime,
          isActive: true,
        });

        io.emit("poll:results", pollManager.getResults());

        setTimeout(() => {
          if (pollManager.currentPoll?.id === poll.id) {
            handlePollTimeout(io, poll.id);
          }
        }, poll.timeLimit * 1000);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("student:join", (name) => {
      try {
        pollManager.addStudent(socket.id, name);

        socket.emit("student:joined", { socketId: socket.id, name });
        socket.join("students");

        const currentPoll = pollManager.getCurrentPoll();
        if (currentPoll) socket.emit("poll:new", currentPoll);

        const results = pollManager.getResults();
        if (results?.totalVotes > 0) socket.emit("poll:results", results);

        socket.emit("chat:history", chatMessages);
        io.emit("students:list", pollManager.getStudentsList());
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("poll:answer", (index) => {
      try {
        const results = pollManager.submitAnswer(socket.id, index);
        io.emit("poll:results", results);
        io.emit("students:list", pollManager.getStudentsList());

        if (pollManager.areAllStudentsAnswered()) {
          io.emit("poll:ended", { reason: "all_answered" });
        }
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("student:kick", (id) => {
      const target = io.sockets.sockets.get(id);
      if (target) {
        target.emit("student:kicked");
        pollManager.removeStudent(id);
        io.emit("students:list", pollManager.getStudentsList());
      }
    });

    socket.on("chat:message", (data) => {
      const msg = {
        id: Date.now(),
        sender: data.sender,
        senderName: data.senderName,
        text: data.text,
        timestamp: Date.now(),
      };

      chatMessages.push(msg);
      io.emit("chat:message", msg);
    });

    socket.on("poll:history:request", () => {
      socket.emit("poll:history", pollManager.getPollHistory());
    });

    socket.on("disconnect", () => {
      if (pollManager.hasStudent(socket.id)) {
        pollManager.removeStudent(socket.id);
        io.emit("students:list", pollManager.getStudentsList());
      }
      if (teacherSocket.id === socket.id) {
        teacherSocket.id = null;
      }
    });
  });
}

function handlePollTimeout(io, pollId) {
  const current = pollManager.getCurrentPoll();
  if (current?.id === pollId && current.isActive) {
    const results = pollManager.endPoll();
    io.emit("poll:results", results);
    io.emit("poll:ended", { reason: "timeout" });
  }
}

export { pollManager };
