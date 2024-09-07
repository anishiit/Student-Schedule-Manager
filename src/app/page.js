"use client"
import { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, BookOpen, GraduationCap, Download, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import jsPDF from 'jspdf'



const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const LOCAL_STORAGE_KEY = 'studentScheduleData'
const EXPIRATION_TIME = 6 * 30 * 24 * 60 * 60 * 1000 // 6 months in milliseconds

function DailySchedule({ subjects }) {
  const sortedSubjects = [...subjects].sort((a, b) => a.time.localeCompare(b.time))

  const subjectsByDay = daysOfWeek.reduce((acc, day) => {
    acc[day] = sortedSubjects.filter(subject => subject.days.includes(day))
    return acc
  },{})

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {daysOfWeek.map(day => {
        const daySubjects = subjectsByDay[day]
        if (daySubjects.length === 0) return null

        return (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="capitalize">{day}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {daySubjects.map(subject => (
                  <li key={subject.id} className="p-2 bg-gray-100 rounded">
                    <p className="font-medium">{subject.name}</p>
                    <p className="text-sm text-gray-600">
                      {subject.teacher} - {subject.time}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default function StudentScheduleManager() {
  const [view, setView] = useState('weekly')
  const [subjects, setSubjects] = useState([])
  const [exams, setExams] = useState([])
  const [newSubject, setNewSubject] = useState({
    name: '',
    teacher: '',
    time: '',
    days: [] 
  })
  const [newExam, setNewExam] = useState({
    name: '',
    date: '',
    time: '',
    location: ''
  })

  const scheduleRef = useRef(null)

  useEffect(() => {
    loadFromLocalStorage()
  }, [])

  useEffect(() => {
    saveToLocalStorage()
  }, [subjects, exams])

  const saveToLocalStorage = () => {
    const data = {
      subjects,
      exams,
      timestamp: Date.now()
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
  }

  const loadFromLocalStorage = () => {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (storedData) {
      const { subjects, exams, timestamp } = JSON.parse(storedData)
      const currentTime = Date.now()
      if (currentTime - timestamp < EXPIRATION_TIME) {
        setSubjects(subjects)
        setExams(exams)
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY)
      }
    }
  }

  const handleSubjectChange = (e) => {
    const { name, value } = e.target
    setNewSubject(prev => ({ ...prev, [name]: value }))
  }

  const handleSubjectDayChange = (day) => {
    setNewSubject(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }))
  }

  const addSubject = (event) => {
    event.preventDefault()
    const subject = {
      id: Date.now().toString(),
      ...newSubject
    }
    setSubjects(prev => [...prev, subject])
    setNewSubject({
      name: '',
      teacher: '',
      time: '',
      days: []
    })
  }

  const removeSubject = (id) => {
    setSubjects(prev => prev.filter(subject => subject.id !== id))
  }

  const handleExamChange = (e) => {
    const { name, value } = e.target
    setNewExam(prev => ({ ...prev, [name]: value }))
  }

  const addExam = (event) => {
    event.preventDefault()
    const exam = {
      id: Date.now().toString(),
      ...newExam
    }
    setExams(prev => [...prev, exam])
    setNewExam({
      name: '',
      date: '',
      time: '',
      location: ''
    })
  }

  const removeExam = (id) => {
    setExams(prev => prev.filter(exam => exam.id !== id))
  }

  const downloadPDF = () => {
    const pdf = new jsPDF()
    pdf.text("Student Schedule", 20, 20)

    let yOffset = 40

    // Add subjects to PDF
    pdf.setFontSize(16)
    pdf.text("Subjects", 20, yOffset)
    yOffset += 10

    pdf.setFontSize(12)
    subjects.forEach((subject, index) => {
      pdf.text(`${index + 1}. ${subject.name}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Teacher: ${subject.teacher}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Days: ${subject.days.join(', ')}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Time: ${subject.time}`, 20, yOffset)
      yOffset += 10

      if (yOffset > 270) {
        pdf.addPage()
        yOffset = 20
      }
    })

    yOffset += 10

    // Add exams to PDF
    pdf.setFontSize(16)
    pdf.text("Exams", 20, yOffset)
    yOffset += 10

    pdf.setFontSize(12)
    exams.forEach((exam, index) => {
      pdf.text(`${index + 1}. ${exam.name}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Date: ${exam.date}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Time: ${exam.time}`, 20, yOffset)
      yOffset += 5
      pdf.text(`   Location: ${exam.location}`, 20, yOffset)
      yOffset += 10

      if (yOffset > 270) {
        pdf.addPage()
        yOffset = 20
      }
    })

    pdf.save("student_schedule.pdf")
  }

  return (
    <div className="min-h-screen p-4 bg-gray-100 text-gray-900">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Student Schedule Manager</h1>
        <div className="flex items-center space-x-4">
          <Button onClick={downloadPDF}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </header>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <div className="flex justify-between items-center">
         
          </div>
          <div className="bg-white p-4 rounded-lg shadow" ref={scheduleRef}>
            <h3 className="text-lg font-semibold mb-4">Schedule View ({view})</h3>
            <DailySchedule subjects={subjects} />
            <div className="mt-4">
              <h4 className="font-medium mb-2">Exams</h4>
              <ul className="space-y-2">
                {exams.map((exam) => (
                  <li key={exam.id} className="p-2 bg-gray-100 rounded">
                    <p className="font-medium">{exam.name}</p>
                    <p className="text-sm text-gray-600">
                      {exam.date} at {exam.time} - {exam.location}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <form onSubmit={addSubject} className="space-y-4">
            <Input
              type="text"
              name="name"
              placeholder="Subject Name"
              value={newSubject.name}
              onChange={handleSubjectChange}
              required
            />
            <Input
              type="text"
              name="teacher"
              placeholder="Teacher Name"
              value={newSubject.teacher}
              onChange={handleSubjectChange}
              required
            />
            <Input
              type="time"
              name="time"
              value={newSubject.time}
              onChange={handleSubjectChange}
              required
            />
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={newSubject.days.includes(day)}
                      onCheckedChange={() => handleSubjectDayChange(day)}
                    />
                    <Label htmlFor={`day-${day}`}>{day.charAt(0).toUpperCase() + day.slice(1)}</Label>
                  </div>
                ))}
              </div>
            </div>
            <Button type="submit">
              <BookOpen className="mr-2 h-4 w-4" /> Add Subject
            </Button>
          </form>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Subject List</h3>
            {subjects.length === 0 ? (
              <p className="text-center text-gray-500">No subjects added yet.</p>
            ) : (
              <ul className="space-y-2">
                {subjects.map((subject) => (
                  <li key={subject.id} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                    <div>
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-sm text-gray-600">
                        {subject.teacher} - {subject.days.join(', ')} at {subject.time}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSubject(subject.id)}
                      aria-label={`Remove ${subject.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="exams" className="space-y-4">
          <form onSubmit={addExam} className="space-y-4">
            <Input
              type="text"
              name="name"
              placeholder="Exam Name"
              value={newExam.name}
              onChange={handleExamChange}
              required
            />
            <Input
              type="date"
              name="date"
              value={newExam.date}
              onChange={handleExamChange}
              required
            />
            <Input
              type="time"
              name="time"
              value={newExam.time}
              onChange={handleExamChange}
              required
            />
            <Input
              type="text"
              name="location"
              placeholder="Location"
              value={newExam.location}
              onChange={handleExamChange}
              required
            />
            <Button type="submit">
              <GraduationCap className="mr-2 h-4 w-4" /> Add Exam
            </Button>
          </form>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Exam List</h3>
            {exams.length === 0 ? (
              <p className="text-center text-gray-500">No exams added yet.</p>
            ) : (
              <ul className="space-y-2">
                {exams.map((exam) => (
                  <li key={exam.id} className="flex justify-between items-center p-2 bg-gray-100 rounded">
                    <div>
                      <p className="font-medium">{exam.name}</p>
                      <p className="text-sm text-gray-600">
                        {exam.date} at {exam.time} - {exam.location}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExam(exam.id)}
                      aria-label={`Remove ${exam.name}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <footer><p className='text-center text-gray-500 py-2'>Created by Anish Kumar Singh</p></footer>
    </div>
  )
}