class PollManager {
  constructor() {
    this.currentPoll = null;
    this.pollHistory = [];
    this.students = new Map();
  }

  createPoll(data) {
    const { question, options, correctAnswer, timeLimit = 60 } = data;

    if (!question || !options || options.length !== 4) {
      throw new Error("Invalid poll data");
    }
    if (correctAnswer < 0 || correctAnswer > 3) {
      throw new Error("Invalid correct answer index");
    }
    if (this.currentPoll && !this.isPollComplete()) {
      throw new Error("Previous poll still active");
    }

    this.students.forEach((s) => {
      s.hasAnswered = false;
      s.answer = null;
    });

    this.currentPoll = {
      id: Date.now(),
      question,
      options: options.map((text, index) => ({
        text,
        index,
        votes: 0,
        isCorrect: index === correctAnswer,
      })),
      correctAnswer,
      timeLimit,
      startTime: Date.now(),
      endTime: null,
      isActive: true,
    };

    return this.currentPoll;
  }

  submitAnswer(socketId, index) {
    if (!this.currentPoll?.isActive) throw new Error("No active poll");

    const student = this.students.get(socketId);
    if (!student) throw new Error("Student not found");
    if (student.hasAnswered) throw new Error("Already answered");
    if (index < 0 || index > 3) throw new Error("Invalid answer index");

    student.hasAnswered = true;
    student.answer = index;
    this.currentPoll.options[index].votes++;

    if (this.areAllStudentsAnswered()) {
      this.endPoll();
    }

    return this.getResults();
  }

  endPoll() {
    if (!this.currentPoll) return;

    this.currentPoll.isActive = false;
    this.currentPoll.endTime = Date.now();

    this.pollHistory.push({
      ...this.currentPoll,
      participants: Array.from(this.students.values()).map((s) => ({
        name: s.name,
        answer: s.answer,
        hasAnswered: s.hasAnswered,
      })),
    });

    return this.getResults();
  }

  getResults() {
    if (!this.currentPoll) return null;

    const totalVotes = this.currentPoll.options.reduce(
      (a, b) => a + b.votes,
      0
    );

    return {
      id: this.currentPoll.id,
      question: this.currentPoll.question,
      options: this.currentPoll.options.map((opt) => ({
        ...opt,
        percentage: totalVotes ? Math.round((opt.votes / totalVotes) * 100) : 0,
      })),
      totalVotes,
      isActive: this.currentPoll.isActive,
      correctAnswer: this.currentPoll.correctAnswer,
    };
  }

  isPollComplete() {
    return !this.currentPoll?.isActive || this.areAllStudentsAnswered();
  }

  areAllStudentsAnswered() {
    if (this.students.size === 0) return false;
    return [...this.students.values()].every((s) => s.hasAnswered);
  }

  addStudent(socketId, name) {
    if (this.students.has(socketId)) throw new Error("Student exists");

    const duplicate = [...this.students.values()].some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) throw new Error("Name already taken");

    this.students.set(socketId, {
      name,
      hasAnswered: false,
      answer: null,
      joinedAt: Date.now(),
    });

    return this.getStudentsList();
  }

  removeStudent(socketId) {
    const student = this.students.get(socketId);
    this.students.delete(socketId);

    if (student?.hasAnswered && this.currentPoll) {
      this.currentPoll.options[student.answer].votes--;
    }

    return this.getStudentsList();
  }

  getStudentsList() {
    return [...this.students.entries()].map(([socketId, s]) => ({
      socketId,
      name: s.name,
      hasAnswered: s.hasAnswered,
      joinedAt: s.joinedAt,
    }));
  }

  getPollHistory() {
    return this.pollHistory;
  }

  getCurrentPoll() {
    if (!this.currentPoll) return null;

    const elapsed = Math.floor(
      (Date.now() - this.currentPoll.startTime) / 1000
    );
    const remaining = Math.max(0, this.currentPoll.timeLimit - elapsed);

    return {
      id: this.currentPoll.id,
      question: this.currentPoll.question,
      options: this.currentPoll.options.map((o) => o.text),
      timeLimit: this.currentPoll.timeLimit,
      remainingTime: remaining,
      startTime: this.currentPoll.startTime,
      isActive: this.currentPoll.isActive,
    };
  }

  hasStudent(socketId) {
    return this.students.has(socketId);
  }

  getStudent(socketId) {
    return this.students.get(socketId);
  }
}

export default PollManager;
