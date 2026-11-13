import type { ScheduleDTO } from "@/contracts";
export function GanttChart({schedule}:{schedule:ScheduleDTO}) {
 return <section className="card">{schedule.tasks.map(task=><p key={task.id}>{task.name}：第 {task.startDay+1} 天开始，持续 {task.durationDays} 天</p>)}</section>;
}
